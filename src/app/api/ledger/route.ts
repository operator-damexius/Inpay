import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import JournalEntry from '@/models/JournalEntry';
import type { IJournalLine } from '@/models/JournalEntry';
import Ledger from '@/models/Ledger';
import LedgerAccount from '@/models/LedgerAccount';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';
import {
  ensureDefaultLedgerAccounts,
  getPnlAccountCode,
  migrateLegacyLedgerEntries,
  postJournalEntry,
} from '@/lib/ledger-accounting';
import {
  getPnlCategoryKind,
  isPnlCategory,
} from '@/lib/pnl-categories';

const PAGE_SIZE = 25;

function getDateFilter(value: string | null, endOfDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError('Use valid YYYY-MM-DD dates.', 400);
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError('Use valid YYYY-MM-DD dates.', 400);
  }
  return date;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toJournalRow(entry: Record<string, unknown>) {
  const lines = Array.isArray(entry.lines) ? entry.lines : [];
  const pnlLine = lines.find((line) =>
    typeof line === 'object' && line !== null && 'pnlCategory' in line &&
    isPnlCategory(line.pnlCategory) && line.pnlCategory !== 'unclassified'
  ) as { pnlCategory?: string; debit?: number; credit?: number } | undefined;
  const category = pnlLine?.pnlCategory;
  const amount = category && getPnlCategoryKind(category as Parameters<typeof getPnlCategoryKind>[0]) === 'income'
    ? Number(pnlLine?.credit ?? 0)
    : category && getPnlCategoryKind(category as Parameters<typeof getPnlCategoryKind>[0]) === 'expense'
      ? -Number(pnlLine?.debit ?? 0)
      : 0;
  const sourceKey = typeof entry.sourceKey === 'string' ? entry.sourceKey : 'journal';
  const isLegacy = sourceKey.startsWith('legacy:');
  return {
    _id: isLegacy ? sourceKey.slice('legacy:'.length) : `journal:${String(entry._id)}`,
    source: isLegacy ? 'legacy' : 'journal',
    type: typeof entry.sourceType === 'string' ? entry.sourceType : sourceKey.split(':')[0],
    reference: String(entry.reference ?? ''),
    description: String(entry.description ?? ''),
    pnlCategory: category,
    amount,
    balance: null,
    date: entry.date,
    createdBy: String(entry.createdBy ?? ''),
    createdAt: entry.createdAt,
    accounts: lines.map((line) => {
      if (typeof line !== 'object' || line === null) return '';
      const account = 'account' in line ? line.account : null;
      if (typeof account !== 'object' || account === null) return '';
      return 'name' in account ? String(account.name) : '';
    }).filter(Boolean).join(', '),
    debit: lines.reduce((sum, line) =>
      sum + (typeof line === 'object' && line !== null && 'debit' in line ? Number(line.debit) : 0), 0),
    credit: lines.reduce((sum, line) =>
      sum + (typeof line === 'object' && line !== null && 'credit' in line ? Number(line.credit) : 0), 0),
  };
}

export const GET = withErrorHandler(async (request: Request) => {
  const username = await getAdminUsername(request);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  await connectToDatabase();
  await migrateLegacyLedgerEntries();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const search = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || '';
  const category = searchParams.get('category') || '';
  const from = getDateFilter(searchParams.get('from'));
  const to = getDateFilter(searchParams.get('to'), true);
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new ApiError('Page must be between 1 and 1000.', 400);
  if (search.length > 100) throw new ApiError('Search must be 100 characters or fewer.', 400);
  if (from && to && from > to) throw new ApiError('The start date must be on or before the end date.', 400);
  if (category && !isPnlCategory(category)) throw new ApiError('Choose a valid P&L category.', 400);
  const date = from || to ? {
    ...(from ? { $gte: from } : {}),
    ...(to ? { $lte: to } : {}),
  } : undefined;
  const regex = search ? new RegExp(escapeRegex(search), 'i') : null;
  const journalFilter: Record<string, unknown> = {};
  if (date) {
    journalFilter.date = date;
  }
  if (type) {
    journalFilter.sourceType = type;
  }
  if (category) {
    journalFilter['lines.pnlCategory'] = category;
  }
  if (regex) {
    journalFilter.$or = [{ reference: regex }, { description: regex }, { createdBy: regex }];
  }
  const [journalCount, journalRows] = await Promise.all([
    JournalEntry.countDocuments(journalFilter),
    JournalEntry.find(journalFilter)
      .populate('lines.account', 'name code type')
      .sort({ date: -1, createdAt: -1, _id: -1 })
      .limit(page * PAGE_SIZE)
      .lean(),
  ]);
  const rows: Array<Record<string, unknown>> = journalRows
    .map((entry) => toJournalRow(entry as unknown as Record<string, unknown>))
    .sort((left, right) =>
      new Date(String(right.date)).getTime() - new Date(String(left.date)).getTime() ||
      new Date(String(right.createdAt)).getTime() - new Date(String(left.createdAt)).getTime()
    );
  const legacyIds = rows
    .filter((row) => row.source === 'legacy')
    .map((row) => String(row._id));
  if (legacyIds.length) {
    const auditRecords = await Ledger.find({ _id: { $in: legacyIds } })
      .select('_id auditLog')
      .lean();
    const auditById = new Map(auditRecords.map((record) => [String(record._id), record.auditLog]));
    for (const row of rows) {
      if (row.source === 'legacy') row.auditLog = auditById.get(String(row._id)) || [];
    }
  }
  const start = (page - 1) * PAGE_SIZE;
  return NextResponse.json({
    entries: rows.slice(start, start + PAGE_SIZE),
    total: journalCount,
    page,
    pageSize: PAGE_SIZE,
  });
});

export const POST = withErrorHandler(async (request: Request) => {
  if (!isSameOriginRequest(request)) throw new ApiError('Invalid request origin.', 403);
  const username = await getAdminUsername(request);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null) throw new ApiError('Enter valid ledger entry details.', 400);
  const values = body as Record<string, unknown>;
  const type = typeof values.type === 'string' ? values.type : '';
  const categoryValue = values.pnlCategory;
  const category = isPnlCategory(categoryValue) ? categoryValue : null;
  const amount = Number(values.amount);
  const reference = typeof values.reference === 'string' ? values.reference.trim() : '';
  const description = typeof values.description === 'string' ? values.description.trim() : '';
  const accountCode = typeof values.accountCode === 'string' ? values.accountCode.trim().toUpperCase() : 'CASH';
  const fromAccountCode = typeof values.fromAccountCode === 'string' ? values.fromAccountCode.trim().toUpperCase() : '';
  const toAccountCode = typeof values.toAccountCode === 'string' ? values.toAccountCode.trim().toUpperCase() : '';
  const dateText = typeof values.date === 'string' ? values.date : '';
  const date = getDateFilter(dateText);
  if (!['item', 'payment', 'adjustment', 'transfer', 'purchase'].includes(type)) {
    throw new ApiError('Choose a valid ledger entry type.', 400);
  }
  if (!category || category === 'unclassified') throw new ApiError('Choose a P&L category.', 400);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new ApiError('Enter a non-zero amount with no more than two decimal places.', 400);
  }
  if (!reference || reference.length > 100) throw new ApiError('Reference is required (100 characters or fewer).', 400);
  if (!description || description.length > 500) throw new ApiError('Description is required (500 characters or fewer).', 400);
  if (!date) throw new ApiError('Choose a valid transaction date.', 400);

  const categoryKind = getPnlCategoryKind(category);
  if (categoryKind === 'income' && amount < 0) throw new ApiError('Income entries must have a positive amount.', 400);
  if (categoryKind === 'expense' && amount > 0) throw new ApiError('Expense entries must have a negative amount.', 400);
  if (categoryKind === 'nonPnl' && category !== 'transfer' && category !== 'adjustment' && category !== 'inventory_asset') {
    throw new ApiError('This category cannot be used for a manual ledger entry.', 400);
  }
  if ((category === 'transfer') !== (type === 'transfer')) {
    throw new ApiError('Choose Transfer as the entry type for a transfer category.', 400);
  }
  if (category === 'transfer' && amount < 0) {
    throw new ApiError('Enter a positive amount for a transfer.', 400);
  }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
    throw new ApiError('Enter an amount with no more than two decimal places.', 400);
  }

  await connectToDatabase();
  await ensureDefaultLedgerAccounts();
  const requiredCodes = category === 'transfer'
    ? [fromAccountCode, toAccountCode]
    : [accountCode, getPnlAccountCode(category) || (category === 'inventory_asset' ? 'INVENTORY' : 'OPENING_EQUITY')];
  const accounts = await LedgerAccount.find({ code: { $in: requiredCodes }, isActive: true });
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  const lines: IJournalLine[] = [];
  if (category === 'transfer') {
    if (!fromAccountCode || !toAccountCode || fromAccountCode === toAccountCode) {
      throw new ApiError('Choose two different accounts for the transfer.', 400);
    }
    const source = accountByCode.get(fromAccountCode);
    const destination = accountByCode.get(toAccountCode);
    if (!source || !destination || source.type !== 'asset' || destination.type !== 'asset') {
      throw new ApiError('Transfers require two active asset accounts.', 400);
    }
    lines.push(
      { account: destination._id, debit: Math.abs(amount), credit: 0, pnlCategory: 'transfer' },
      { account: source._id, debit: 0, credit: Math.abs(amount), pnlCategory: 'transfer' }
    );
  } else if (categoryKind === 'income') {
    const cash = accountByCode.get(accountCode);
    const income = accountByCode.get(getPnlAccountCode(category) || '');
    if (!cash || cash.type !== 'asset' || !income || income.type !== 'income') {
      throw new ApiError('Choose an active asset account and use a supported income category.', 400);
    }
    lines.push(
      { account: cash._id, debit: amount, credit: 0 },
      { account: income._id, debit: 0, credit: amount, pnlCategory: category }
    );
  } else if (categoryKind === 'expense') {
    const cash = accountByCode.get(accountCode);
    const expense = accountByCode.get(getPnlAccountCode(category) || '');
    if (!cash || cash.type !== 'asset' || !expense || expense.type !== 'expense') {
      throw new ApiError('Choose an active asset account and use a supported expense category.', 400);
    }
    lines.push(
      { account: expense._id, debit: Math.abs(amount), credit: 0, pnlCategory: category },
      { account: cash._id, debit: 0, credit: Math.abs(amount) }
    );
  } else if (category === 'inventory_asset') {
    const cash = accountByCode.get(accountCode);
    const inventory = accountByCode.get('INVENTORY');
    if (!cash || cash.type !== 'asset' || !inventory) throw new ApiError('Choose an active payment asset account.', 400);
    if (amount < 0) {
      lines.push(
        { account: inventory._id, debit: Math.abs(amount), credit: 0, pnlCategory: category },
        { account: cash._id, debit: 0, credit: Math.abs(amount) }
      );
    } else {
      lines.push(
        { account: cash._id, debit: amount, credit: 0 },
        { account: inventory._id, debit: 0, credit: amount, pnlCategory: category }
      );
    }
  } else {
    const cash = accountByCode.get(accountCode);
    const equity = accountByCode.get('OPENING_EQUITY');
    if (!cash || cash.type !== 'asset' || !equity) throw new ApiError('Choose an active asset account.', 400);
    if (amount > 0) {
      lines.push(
        { account: cash._id, debit: amount, credit: 0 },
        { account: equity._id, debit: 0, credit: amount, pnlCategory: category }
      );
    } else {
      lines.push(
        { account: equity._id, debit: Math.abs(amount), credit: 0, pnlCategory: category },
        { account: cash._id, debit: 0, credit: Math.abs(amount) }
      );
    }
  }

  const entry = await postJournalEntry({
    sourceKey: `manual:${new mongoose.Types.ObjectId().toString()}`,
    sourceType: type,
    reference,
    description,
    date,
    lines,
    createdBy: username,
  });
  await entry.populate('lines.account', 'name code type');
  return NextResponse.json(toJournalRow(entry.toObject() as unknown as Record<string, unknown>), { status: 201 });
});

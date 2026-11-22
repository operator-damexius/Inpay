import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Ledger from '@/models/Ledger';
import JournalEntry from '@/models/JournalEntry';
import type { IJournalLine } from '@/models/JournalEntry';
import LedgerAccount from '@/models/LedgerAccount';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';
import { getPnlCategoryKind, isPnlCategory } from '@/lib/pnl-categories';
import { ensureDefaultLedgerAccounts, getPnlAccountCode, migrateLegacyLedgerEntries } from '@/lib/ledger-accounting';

export const PATCH = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  if (!isSameOriginRequest(req)) throw new ApiError('Invalid request origin.', 403);
  const username = await getAdminUsername(req);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid ledger entry.', 400);
  }

  const body = await req.json();
  if (typeof body !== 'object' || body === null || !isPnlCategory(body.pnlCategory) || body.pnlCategory === 'unclassified') {
    throw new ApiError('Choose a valid P&L category.', 400);
  }

  await connectToDatabase();
  const entry = await Ledger.findById(id);
  if (!entry) {
    throw new ApiError('Ledger entry not found.', 404);
  }
  await migrateLegacyLedgerEntries();
  const journalEntry = await JournalEntry.findOne({ sourceKey: `legacy:${entry._id.toString()}` });
  if (!journalEntry) throw new ApiError('Ledger entry has no journal record to classify.', 409);

  const categoryKind = getPnlCategoryKind(body.pnlCategory);
  if (categoryKind === 'income' && entry.amount < 0) {
    throw new ApiError('Income entries must have a positive amount.', 400);
  }
  if (categoryKind === 'expense' && entry.amount > 0) {
    throw new ApiError('Expense entries must have a negative amount.', 400);
  }

  const accounts = await ensureDefaultLedgerAccounts();
  const categoryCode = getPnlAccountCode(body.pnlCategory) ||
    (body.pnlCategory === 'inventory_asset' ? 'INVENTORY' :
      body.pnlCategory === 'transfer' ? 'BANK' : 'OPENING_EQUITY');
  const categoryAccount = await LedgerAccount.findOne({ code: categoryCode, isActive: true });
  const cash = accounts.get('CASH');
  const bank = accounts.get('BANK');
  if (!categoryAccount || !cash || !bank) throw new ApiError('Ledger accounts are not available.', 500);
  const liquidityIds = new Set([cash._id.toString(), bank._id.toString()]);
  const categoryLine = journalEntry.lines.find((line: IJournalLine) => !liquidityIds.has(line.account.toString()));
  if (body.pnlCategory === 'transfer') {
    if (categoryLine) categoryLine.account = bank._id;
    for (const line of journalEntry.lines) line.pnlCategory = body.pnlCategory;
  } else {
    if (!categoryLine) throw new ApiError('Could not identify the category account for this ledger entry.', 409);
    categoryLine.account = categoryAccount._id;
    categoryLine.pnlCategory = body.pnlCategory;
  }
  await journalEntry.save();
  entry.auditLog.push({
    action: 'category_changed',
    oldValue: entry.pnlCategory || 'unclassified',
    newValue: body.pnlCategory,
    changedBy: username,
    changedAt: new Date(),
  });
  entry.pnlCategory = body.pnlCategory;
  await entry.save();
  return NextResponse.json(entry);
});

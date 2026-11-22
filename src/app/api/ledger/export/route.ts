import { NextResponse } from 'next/server';
import JournalEntry from '@/models/JournalEntry';
import type { IJournalLine } from '@/models/JournalEntry';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername } from '@/lib/admin-auth';
import { migrateLegacyLedgerEntries } from '@/lib/ledger-accounting';
import { isPnlCategory } from '@/lib/pnl-categories';

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function dateBound(value: string | null, endOfDay: boolean) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError('Use valid YYYY-MM-DD dates.', 400);
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError('Use valid YYYY-MM-DD dates.', 400);
  }
  return date;
}

export const GET = withErrorHandler(async (request: Request) => {
  const username = await getAdminUsername(request);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  await connectToDatabase();
  await migrateLegacyLedgerEntries();
  const { searchParams } = new URL(request.url);
  const from = dateBound(searchParams.get('from'), false);
  const to = dateBound(searchParams.get('to'), true);
  const query = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || '';
  const category = searchParams.get('category') || '';
  if (from && to && from > to) throw new ApiError('The start date must be on or before the end date.', 400);
  if (query.length > 100) throw new ApiError('Search must be 100 characters or fewer.', 400);
  if (category && !isPnlCategory(category)) throw new ApiError('Choose a valid P&L category.', 400);
  const date = from || to ? {
    ...(from ? { $gte: from } : {}),
    ...(to ? { $lte: to } : {}),
  } : undefined;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = query ? new RegExp(escaped, 'i') : undefined;
  const journalFilter: Record<string, unknown> = {};
  if (date) journalFilter.date = date;
  if (type) journalFilter.sourceType = type;
  if (category) journalFilter['lines.pnlCategory'] = category;
  if (pattern) {
    journalFilter.$or = [{ reference: pattern }, { description: pattern }, { createdBy: pattern }];
  }
  const count = await JournalEntry.countDocuments(journalFilter);
  if (count > 50000) throw new ApiError('Narrow the filters to export 50,000 entries or fewer at a time.', 413);
  const journals = await JournalEntry.find(journalFilter)
    .populate('lines.account', 'name code')
    .sort({ date: -1, createdAt: -1 })
    .lean();
  const header = ['Date', 'Type', 'Category', 'Reference', 'Description', 'Accounts', 'Debit', 'Credit', 'Created by'];
  const rows = journals.map((entry) => {
    const categories = [...new Set(entry.lines.map((line: IJournalLine) => line.pnlCategory).filter(Boolean))].join(', ');
    const accounts = entry.lines.map((line: IJournalLine) => {
      const account = line.account;
      return typeof account === 'object' && 'name' in account ? String(account.name) : '';
    }).filter(Boolean).join(', ');
    return [
      new Date(entry.date).toISOString(),
      entry.sourceType || entry.sourceKey.split(':')[0],
      categories,
      entry.reference,
      entry.description,
      accounts,
      entry.lines.reduce((sum: number, line: IJournalLine) => sum + line.debit, 0).toFixed(2),
      entry.lines.reduce((sum: number, line: IJournalLine) => sum + line.credit, 0).toFixed(2),
      entry.createdBy,
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="inpay-ledger.csv"',
      'Cache-Control': 'no-store',
    },
  });
});

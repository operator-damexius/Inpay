import { NextResponse } from 'next/server';
import JournalEntry from '@/models/JournalEntry';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername } from '@/lib/admin-auth';
import { migrateLegacyLedgerEntries } from '@/lib/ledger-accounting';
import { PNL_CATEGORIES } from '@/lib/pnl-categories';

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export const GET = withErrorHandler(async (req: Request) => {
  const username = await getAdminUsername(req);
  if (!username) throw new ApiError('Admin sign-in required.', 401);
  const { searchParams } = new URL(req.url);
  const startDate = parseDate(searchParams.get('from'));
  const endDate = parseDate(searchParams.get('to'));
  if (!startDate || !endDate) throw new ApiError('Valid from and to dates are required.', 400);
  if (startDate > endDate) throw new ApiError('The start date must be on or before the end date.', 400);

  const endExclusive = new Date(endDate);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const dateFilter = { $gte: startDate, $lt: endExclusive };
  const incomeCategories = PNL_CATEGORIES
    .filter((category) => category.kind === 'income')
    .map((category) => category.value);
  const expenseCategories = PNL_CATEGORIES
    .filter((category) => category.kind === 'expense')
    .map((category) => category.value);
  const nonPnlCategories = PNL_CATEGORIES
    .filter((category) => category.kind === 'nonPnl')
    .map((category) => category.value);

  await connectToDatabase();
  await migrateLegacyLedgerEntries();
  const [summaryResult, expensesByType, entryCount] = await Promise.all([
    JournalEntry.aggregate([
      { $match: { date: dateFilter } },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$_id',
          income: {
            $sum: {
              $cond: [
                { $in: ['$lines.pnlCategory', incomeCategories] },
                { $subtract: ['$lines.credit', '$lines.debit'] },
                0,
              ],
            },
          },
          expenses: {
            $sum: {
              $cond: [
                { $in: ['$lines.pnlCategory', expenseCategories] },
                { $subtract: ['$lines.debit', '$lines.credit'] },
                0,
              ],
            },
          },
          categories: { $addToSet: '$lines.pnlCategory' },
        },
      },
      {
        $group: {
          _id: null,
          income: { $sum: '$income' },
          expenses: { $sum: '$expenses' },
          unclassifiedCount: {
            $sum: { $cond: [{ $in: ['unclassified', '$categories'] }, 1, 0] },
          },
          nonPnlCount: {
            $sum: {
              $cond: [
                { $gt: [{ $size: { $setIntersection: ['$categories', nonPnlCategories] } }, 0] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    JournalEntry.aggregate([
      { $match: { date: dateFilter } },
      { $unwind: '$lines' },
      { $match: { 'lines.pnlCategory': { $in: expenseCategories } } },
      {
        $group: {
          _id: '$lines.pnlCategory',
          amount: { $sum: { $subtract: ['$lines.debit', '$lines.credit'] } },
        },
      },
      { $match: { amount: { $gt: 0 } } },
      { $sort: { amount: -1 } },
    ]),
    JournalEntry.countDocuments({ date: dateFilter }),
  ]);
  const summary = summaryResult[0] ?? {
    income: 0,
    expenses: 0,
    unclassifiedCount: 0,
    nonPnlCount: 0,
  };
  return NextResponse.json({
    income: summary.income,
    expenses: summary.expenses,
    netProfit: summary.income - summary.expenses,
    entryCount,
    unclassifiedCount: summary.unclassifiedCount,
    nonPnlCount: summary.nonPnlCount,
    expensesByType: expensesByType.map((entry) => ({
      type: entry._id,
      amount: entry.amount,
    })),
  });
});

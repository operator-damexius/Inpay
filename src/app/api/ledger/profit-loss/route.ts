import { NextResponse } from 'next/server';
import Ledger from '@/models/Ledger';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { PNL_CATEGORIES } from '@/lib/pnl-categories';

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export const GET = withErrorHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const startDate = parseDate(searchParams.get('from'));
  const endDate = parseDate(searchParams.get('to'));
  if (!startDate || !endDate) {
    throw new ApiError('Valid from and to dates are required.', 400);
  }
  if (startDate > endDate) {
    throw new ApiError('The start date must be on or before the end date.', 400);
  }

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
  const [summaryResult, expensesByType] = await Promise.all([
    Ledger.aggregate([
      { $match: { date: dateFilter } },
      {
        $group: {
          _id: null,
          income: {
            $sum: {
              $cond: [
                { $and: [{ $in: ['$pnlCategory', incomeCategories] }, { $gt: ['$amount', 0] }] },
                '$amount',
                0,
              ],
            },
          },
          expenses: {
            $sum: {
              $cond: [
                { $and: [{ $in: ['$pnlCategory', expenseCategories] }, { $lt: ['$amount', 0] }] },
                { $abs: '$amount' },
                0,
              ],
            },
          },
          entryCount: { $sum: 1 },
          unclassifiedCount: {
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ['$pnlCategory', 'unclassified'] }, 'unclassified'] },
                1,
                0,
              ],
            },
          },
          nonPnlCount: {
            $sum: { $cond: [{ $in: ['$pnlCategory', nonPnlCategories] }, 1, 0] },
          },
        },
      },
    ]),
    Ledger.aggregate([
      { $match: { date: dateFilter, pnlCategory: { $in: expenseCategories }, amount: { $lt: 0 } } },
      {
        $group: {
          _id: '$pnlCategory',
          amount: { $sum: { $abs: '$amount' } },
        },
      },
      { $sort: { amount: -1 } },
    ]),
  ]);

  const summary = summaryResult[0] ?? {
    income: 0,
    expenses: 0,
    entryCount: 0,
    unclassifiedCount: 0,
    nonPnlCount: 0,
  };
  return NextResponse.json({
    income: summary.income,
    expenses: summary.expenses,
    netProfit: summary.income - summary.expenses,
    entryCount: summary.entryCount,
    unclassifiedCount: summary.unclassifiedCount,
    nonPnlCount: summary.nonPnlCount,
    expensesByType: expensesByType.map((entry) => ({
      type: entry._id,
      amount: entry.amount,
    })),
  });
});

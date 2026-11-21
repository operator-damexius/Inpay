import { NextResponse } from 'next/server';
import Ledger from '@/models/Ledger';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getPnlCategoryKind, isPnlCategory } from '@/lib/pnl-categories';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const entries = await Ledger.find().sort({ date: -1, createdAt: -1 }).limit(100).lean();
  return NextResponse.json(entries);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    throw new ApiError('Enter a non-zero valid amount.', 400);
  }
  if (!isPnlCategory(body.pnlCategory) || body.pnlCategory === 'unclassified') {
    throw new ApiError('Choose a P&L category for this entry.', 400);
  }
  const categoryKind = getPnlCategoryKind(body.pnlCategory);
  if (categoryKind === 'income' && amount < 0) {
    throw new ApiError('Income entries must have a positive amount.', 400);
  }
  if (categoryKind === 'expense' && amount > 0) {
    throw new ApiError('Expense entries must have a negative amount.', 400);
  }

  const lastEntry = await Ledger.findOne().sort({ date: -1, createdAt: -1 }).lean();
  const previousBalance = lastEntry ? (lastEntry as unknown as { balance: number }).balance : 0;
  const newBalance = previousBalance + amount;

  const entry = await Ledger.create({
    type: body.type,
    pnlCategory: body.pnlCategory,
    reference: body.reference,
    description: body.description,
    amount,
    balance: newBalance,
    date: body.date || new Date(),
    createdBy: body.createdBy || 'system',
  });

  return NextResponse.json(entry, { status: 201 });
});

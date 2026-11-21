import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Ledger from '@/models/Ledger';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getPnlCategoryKind, isPnlCategory } from '@/lib/pnl-categories';

export const PATCH = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid ledger entry.', 400);
  }

  const body = await req.json();
  if (!isPnlCategory(body.pnlCategory) || body.pnlCategory === 'unclassified') {
    throw new ApiError('Choose a valid P&L category.', 400);
  }

  await connectToDatabase();
  const entry = await Ledger.findById(id);
  if (!entry) {
    throw new ApiError('Ledger entry not found.', 404);
  }

  const categoryKind = getPnlCategoryKind(body.pnlCategory);
  if (categoryKind === 'income' && entry.amount < 0) {
    throw new ApiError('Income entries must have a positive amount.', 400);
  }
  if (categoryKind === 'expense' && entry.amount > 0) {
    throw new ApiError('Expense entries must have a negative amount.', 400);
  }

  entry.pnlCategory = body.pnlCategory;
  await entry.save();
  return NextResponse.json(entry);
});

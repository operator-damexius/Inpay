import { NextResponse } from 'next/server';
import '@/models/Category';
import '@/models/Item';
import '@/models/Location';
import StockBalance from '@/models/StockBalance';
import '@/models/Unit';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const balances = await StockBalance.find()
    .populate({ path: 'item', populate: [{ path: 'category' }, { path: 'unit' }] })
    .populate('location')
    .sort({ updatedAt: -1 })
    .lean();
  return NextResponse.json(balances.filter((balance) => balance.item && balance.location));
});

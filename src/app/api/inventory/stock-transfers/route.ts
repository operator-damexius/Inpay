import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import StockTransfer from '@/models/StockTransfer';
import Item from '@/models/Item';
import Location from '@/models/Location';
import StockBalance from '@/models/StockBalance';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const transfers = await StockTransfer.find()
    .populate({ path: 'item', populate: 'unit' })
    .populate('fromLocation toLocation')
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(transfers);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const qty = Number(body.qty);
  if (
    !mongoose.isValidObjectId(body.itemId) ||
    !mongoose.isValidObjectId(body.fromLocationId) ||
    !mongoose.isValidObjectId(body.toLocationId)
  ) {
    throw new ApiError('Select an item, source location, and destination location.', 400);
  }
  const fromLocationId = new mongoose.Types.ObjectId(body.fromLocationId);
  const toLocationId = new mongoose.Types.ObjectId(body.toLocationId);
  if (fromLocationId.equals(toLocationId)) {
    throw new ApiError('Source and destination locations must be different.', 400);
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new ApiError('Transfer quantity must be a positive whole number.', 400);
  }
  const [item, fromExists, toExists] = await Promise.all([
    Item.findById(body.itemId),
    Location.exists({ _id: body.fromLocationId }),
    Location.exists({ _id: body.toLocationId }),
  ]);
  if (!item || !fromExists || !toExists) {
    throw new ApiError('The selected item or location no longer exists.', 400);
  }
  const sourceBalance = await StockBalance.findOne({
    item: body.itemId,
    location: fromLocationId,
  });
  if (!sourceBalance || sourceBalance.quantity < qty) {
    if (!sourceBalance && item.location?.equals(fromLocationId) && item.stockOnHand > 0) {
      throw new ApiError(
        'This item’s existing stock has not been initialized by location. Run npm run migrate:stock-balances first.',
        409
      );
    }
    throw new ApiError('There is not enough stock at the selected source location.', 409);
  }

  const transfer = await StockTransfer.create({
    item: body.itemId,
    fromLocation: body.fromLocationId,
    toLocation: body.toLocationId,
    qty,
    refNo: body.refNo || null,
    status: 'Pending',
  });
  await transfer.populate({ path: 'item', populate: 'unit' });
  await transfer.populate('fromLocation toLocation');
  return NextResponse.json(transfer, { status: 201 });
});

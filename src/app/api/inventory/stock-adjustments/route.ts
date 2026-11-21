import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import StockAdjustment from '@/models/StockAdjustment';
import Item from '@/models/Item';
import Location from '@/models/Location';
import StockBalance from '@/models/StockBalance';
import '@/models/Unit';
import { connectToDatabase } from '@/lib/mongoose';
import { addStock, removeStock } from '@/lib/stock-balances';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const adj = await StockAdjustment.find()
    .populate({ path: 'item', populate: 'unit' })
    .populate('location')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return NextResponse.json(adj);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const qty = Number(body.qty);
  if (
    !mongoose.isValidObjectId(body.itemId) ||
    !mongoose.isValidObjectId(body.locationId) ||
    !['Add', 'Subtract', 'Set'].includes(body.type)
  ) {
    throw new ApiError('Select an item, location, and adjustment type.', 400);
  }
  if (!Number.isInteger(qty) || qty < 0 || (body.type !== 'Set' && qty === 0)) {
    throw new ApiError('Quantity must be a positive whole number (or zero when setting stock).', 400);
  }
  const locationExists = await Location.exists({ _id: body.locationId });
  if (!locationExists) throw new ApiError('The selected location no longer exists.', 400);

  const session = await mongoose.startSession();
  let adjustmentId = '';
  try {
    await session.withTransaction(async () => {
      const item = await Item.findById(body.itemId).session(session);
      if (!item) throw new ApiError('Item not found.', 404);

      const balance = await StockBalance.findOne({
        item: body.itemId,
        location: body.locationId,
      }).session(session);
      const current = balance?.quantity || 0;
      const delta = body.type === 'Add' ? qty : body.type === 'Subtract' ? -qty : qty - current;

      if (delta < 0) {
        const removed = await removeStock(body.itemId, body.locationId, -delta, session);
        if (!removed) throw new ApiError('Not enough stock at this location for that adjustment.', 409);
      } else {
        await addStock(body.itemId, body.locationId, delta, session);
      }

      if (delta !== 0) {
        const update = await Item.updateOne(
          delta < 0
            ? { _id: body.itemId, stockOnHand: { $gte: -delta } }
            : { _id: body.itemId },
          { $inc: { stockOnHand: delta } },
          { session }
        );
        if (update.modifiedCount !== 1) {
          throw new ApiError('The item stock changed; refresh and try again.', 409);
        }
      }

      const [adjustment] = await StockAdjustment.create([{
        item: body.itemId,
        location: body.locationId,
        type: body.type,
        qty,
        reason: body.reason || null,
        refNo: body.refNo || null,
        createdBy: 'system',
      }], { session });
      adjustmentId = adjustment._id.toString();
    });
  } finally {
    await session.endSession();
  }

  if (!adjustmentId) throw new ApiError('Stock adjustment was not created.', 500);
  const adjustment = await StockAdjustment.findById(adjustmentId);
  if (!adjustment) throw new ApiError('Stock adjustment was not found after creation.', 500);
  await adjustment.populate({ path: 'item', populate: 'unit' });
  await adjustment.populate('location');
  return NextResponse.json(adjustment, { status: 201 });
});

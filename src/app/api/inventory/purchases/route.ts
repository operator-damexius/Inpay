import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Purchase from '@/models/Purchase';
import Item from '@/models/Item';
import Location from '@/models/Location';
import '@/models/Unit';
import { connectToDatabase } from '@/lib/mongoose';
import { addStock } from '@/lib/stock-balances';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const purchases = await Purchase.find()
    .populate({ path: 'item', populate: 'unit' })
    .populate('location')
    .sort({ purchaseDate: -1, createdAt: -1 })
    .lean();
  return NextResponse.json(purchases);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const qty = Number(body.qty);
  const unitCost = Number(body.unitCost);
  const status = body.status || 'Ordered';
  const purchaseDate = new Date(body.purchaseDate);
  if (
    !mongoose.isValidObjectId(body.itemId) ||
    !mongoose.isValidObjectId(body.locationId) ||
    !['Ordered', 'Received', 'Cancelled'].includes(status)
  ) {
    throw new ApiError('Select an item, destination location, and valid purchase status.', 400);
  }
  if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0 || Number.isNaN(purchaseDate.getTime())) {
    throw new ApiError('Enter a valid quantity, unit cost, and purchase date.', 400);
  }
  const locationExists = await Location.exists({ _id: body.locationId });
  if (!locationExists) throw new ApiError('The selected location no longer exists.', 400);

  const session = await mongoose.startSession();
  let purchaseId = '';
  try {
    await session.withTransaction(async () => {
      const itemExists = await Item.exists({ _id: body.itemId }).session(session);
      if (!itemExists) throw new ApiError('Item not found.', 404);

      const [purchase] = await Purchase.create([{
        item: body.itemId,
        location: body.locationId,
        supplier: body.supplier || null,
        qty,
        unitCost,
        totalCost: qty * unitCost,
        purchaseDate,
        status,
        reference: body.reference || null,
        receivedAt: status === 'Received' ? new Date() : undefined,
      }], { session });
      purchaseId = purchase._id.toString();

      if (status === 'Received') {
        await addStock(body.itemId, body.locationId, qty, session, qty);
        await Item.updateOne({ _id: body.itemId }, { $inc: { stockOnHand: qty } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  if (!purchaseId) throw new ApiError('Purchase was not created.', 500);
  const purchase = await Purchase.findById(purchaseId)
    .populate({ path: 'item', populate: 'unit' })
    .populate('location');
  if (!purchase) throw new ApiError('Purchase was not found after creation.', 500);
  return NextResponse.json(purchase, { status: 201 });
});

import { NextResponse } from 'next/server';
import '@/models/Category';
import Item from '@/models/Item';
import Location from '@/models/Location';
import Unit from '@/models/Unit';
import { connectToDatabase } from '@/lib/mongoose';
import mongoose from 'mongoose';
import { addStock } from '@/lib/stock-balances';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const items = await Item.find()
    .populate('category unit location')
    .sort({ sku: 1 })
    .lean();
  return NextResponse.json(items);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const stockOnHand = Number(body.stockOnHand || 0);
  const price = Number(body.price || 0);
  const sellingPrice = Number(body.sellingPrice || 0);
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw new ApiError('Inventory and selling prices must be valid non-negative amounts.', 400);
  }
  if (!Number.isInteger(stockOnHand) || stockOnHand < 0) {
    throw new ApiError('Initial stock must be a non-negative whole number.', 400);
  }
  if (stockOnHand > 0 && !body.location) {
    throw new ApiError('Choose a location for the initial stock.', 400);
  }
  if (body.location && !mongoose.isValidObjectId(body.location)) {
    throw new ApiError('Select a valid stock location.', 400);
  }
  if (body.location && !(await Location.exists({ _id: body.location }))) {
    throw new ApiError('The selected location no longer exists.', 400);
  }
  if (!mongoose.isValidObjectId(body.unit) || !(await Unit.exists({ _id: body.unit }))) {
    throw new ApiError('Choose a valid unit of measure for the item.', 400);
  }

  const session = await mongoose.startSession();
  let item;
  try {
    await session.withTransaction(async () => {
      [item] = await Item.create([{
        sku: body.sku,
        name: body.name,
        category: body.category || null,
        unit: body.unit || null,
        location: body.location || null,
        price,
        sellingPrice,
        reorderLevel: Number(body.reorderLevel || 0),
        stockOnHand,
        icon: body.icon || null,
        isActive: body.isActive !== false,
      }], { session });

      if (body.location) {
        await addStock(item._id, body.location, stockOnHand, session);
      }
    });
  } finally {
    await session.endSession();
  }

  return NextResponse.json(item, { status: 201 });
});

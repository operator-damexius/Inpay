import { NextResponse } from 'next/server';
import Item from '@/models/Item';
import StockBalance from '@/models/StockBalance';
import Unit from '@/models/Unit';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid item.', 400);
  }
  await connectToDatabase();
  const body = await req.json();
  const price = Number(body.price || 0);
  const sellingPrice = Number(body.sellingPrice || 0);
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw new ApiError('Inventory and selling prices must be valid non-negative amounts.', 400);
  }
  if (!mongoose.isValidObjectId(body.unit) || !(await Unit.exists({ _id: body.unit }))) {
    throw new ApiError('Choose a valid unit of measure for the item.', 400);
  }
  const item = await Item.findByIdAndUpdate(
    id,
    {
      sku: body.sku,
      name: body.name,
      category: body.category || null,
      unit: body.unit || null,
      location: body.location || null,
      price,
      sellingPrice,
      reorderLevel: parseInt(body.reorderLevel || 0),
      icon: body.icon || null,
      notes: body.notes || null,
      isActive: body.isActive !== false,
    },
    { new: true }
  );
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(item);
});

export const DELETE = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await StockBalance.deleteMany({ item: id }, { session });
      await Item.findByIdAndDelete(id, { session });
    });
  } finally {
    await session.endSession();
  }
  return NextResponse.json({ ok: true });
});

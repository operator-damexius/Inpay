import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Purchase from '@/models/Purchase';
import Item from '@/models/Item';
import { addStock } from '@/lib/stock-balances';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) throw new ApiError('Invalid purchase ID.', 400);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const purchase = await Purchase.findById(id).session(session);
      if (!purchase) throw new ApiError('Purchase not found.', 404);
      if (purchase.status !== 'Ordered') {
        throw new ApiError('This purchase has already been processed.', 409);
      }

      const item = await Item.findById(purchase.item).session(session);
      if (!item) throw new ApiError('The purchase item no longer exists.', 404);
      const locationId = purchase.location || item.location;
      if (!locationId) {
        throw new ApiError('Assign a location to this purchase or item before receiving it.', 400);
      }

      await addStock(item._id, locationId, purchase.qty, session, purchase.qty);
      await Item.updateOne(
        { _id: item._id },
        { $inc: { stockOnHand: purchase.qty } },
        { session }
      );
      purchase.location = locationId;
      purchase.status = 'Received';
      purchase.receivedAt = new Date();
      await purchase.save({ session });
    });

    const purchase = await Purchase.findById(id)
      .populate({ path: 'item', populate: 'unit' })
      .populate('location')
      .lean();
    return NextResponse.json(purchase);
  } finally {
    await session.endSession();
  }
});

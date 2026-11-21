import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Item from '@/models/Item';
import '@/models/Location';
import StockTransfer from '@/models/StockTransfer';
import '@/models/Unit';
import { connectToDatabase } from '@/lib/mongoose';
import { addStock, removeStock } from '@/lib/stock-balances';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const POST = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  await connectToDatabase();

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid transfer ID.', 400);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findById(id).session(session);
      if (!transfer) throw new ApiError('Transfer not found.', 404);
      if (transfer.status !== 'Pending') {
        throw new ApiError('This transfer has already been processed.', 409);
      }
      if (!transfer.fromLocation || !transfer.toLocation) {
        throw new ApiError('This older transfer is missing a source or destination location.', 400);
      }

      const itemExists = await Item.exists({ _id: transfer.item }).session(session);
      if (!itemExists) throw new ApiError('The transfer item no longer exists.', 404);

      const removed = await removeStock(
        transfer.item,
        transfer.fromLocation,
        transfer.qty,
        session
      );
      if (!removed) {
        throw new ApiError('Not enough stock at the source location to receive this transfer.', 409);
      }

      await addStock(
        transfer.item,
        transfer.toLocation,
        transfer.qty,
        session,
        removed.cogsEligibleQuantity
      );

      const updated = await StockTransfer.updateOne(
        { _id: transfer._id, status: 'Pending' },
        { $set: { status: 'Completed', completedAt: new Date() } },
        { session }
      );
      if (updated.modifiedCount !== 1) {
        throw new ApiError('This transfer has already been processed.', 409);
      }
    });

    const transfer = await StockTransfer.findById(id)
      .populate({ path: 'item', populate: 'unit' })
      .populate('fromLocation toLocation')
      .lean();
    return NextResponse.json(transfer);
  } finally {
    await session.endSession();
  }
});

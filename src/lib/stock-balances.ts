import type { ClientSession, Types } from 'mongoose';
import StockBalance from '@/models/StockBalance';
import { getCogsEligibleQuantityRemoved } from './cogs-stock';

type Id = string | Types.ObjectId;

export async function addStock(
  itemId: Id,
  locationId: Id,
  quantity: number,
  session: ClientSession,
  cogsEligibleQuantity = 0
) {
  await StockBalance.updateOne(
    { item: itemId, location: locationId },
    {
      $setOnInsert: { item: itemId, location: locationId },
      $inc: { quantity, cogsEligibleQuantity },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, session }
  );
}

export async function removeStock(
  itemId: Id,
  locationId: Id,
  quantity: number,
  session: ClientSession
) {
  const balance = await StockBalance.collection.findOne(
    { item: itemId, location: locationId },
    { session }
  );
  if (!balance) return null;

  const available = Number(balance.quantity);
  const eligible = Number(balance.cogsEligibleQuantity ?? 0);
  if (
    !Number.isFinite(available) ||
    available < 0 ||
    !Number.isFinite(eligible) ||
    eligible < 0 ||
    eligible > available
  ) {
    throw new Error(`Invalid stock balance for item ${itemId} at location ${locationId}.`);
  }
  if (available < quantity) return null;

  const cogsEligibleQuantity = getCogsEligibleQuantityRemoved(available, eligible, quantity);
  const eligibilityFilter = balance.cogsEligibleQuantity === undefined
    ? { cogsEligibleQuantity: { $exists: false } }
    : { cogsEligibleQuantity: balance.cogsEligibleQuantity };
  const result = await StockBalance.collection.updateOne(
    {
      _id: balance._id,
      quantity: { $gte: quantity },
      ...eligibilityFilter,
    },
    {
      $inc: { quantity: -quantity },
      $set: {
        cogsEligibleQuantity: eligible - cogsEligibleQuantity,
        updatedAt: new Date(),
      },
    },
    { session }
  );

  return result.modifiedCount === 1 ? { cogsEligibleQuantity } : null;
}

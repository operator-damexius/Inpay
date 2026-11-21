import { NextResponse } from 'next/server';
import Purchase from '@/models/Purchase';
import Sale from '@/models/Sale';
import StockAdjustment from '@/models/StockAdjustment';
import StockTransfer from '@/models/StockTransfer';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';
import {
  getRecentInventoryActivity,
  type RecentInventoryActivity,
} from '@/lib/recent-inventory-activity';

type PopulatedItem = {
  sku: string;
  name: string;
  unit?: { code?: string; name?: string } | null;
};

function getPopulatedItem(value: unknown): PopulatedItem | null {
  if (typeof value !== 'object' || value === null || !('sku' in value) || !('name' in value)) {
    return null;
  }
  if (typeof value.sku !== 'string' || typeof value.name !== 'string') return null;
  const unit = 'unit' in value && typeof value.unit === 'object' && value.unit !== null
    ? {
        code: 'code' in value.unit && typeof value.unit.code === 'string' ? value.unit.code : undefined,
        name: 'name' in value.unit && typeof value.unit.name === 'string' ? value.unit.name : undefined,
      }
    : null;
  return { sku: value.sku, name: value.name, unit };
}

function getPopulatedLocation(value: unknown): { name: string } | null {
  if (typeof value !== 'object' || value === null || !('name' in value) || typeof value.name !== 'string') {
    return null;
  }
  return { name: value.name };
}

function getId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toHexString' in value &&
    typeof value.toHexString === 'function'
  ) {
    return value.toHexString();
  }
  throw new Error('Inventory activity record has an invalid ID.');
}

const itemLabel = (item: PopulatedItem | null) =>
  item ? `${item.sku} - ${item.name}` : 'Item unavailable';

const unitCode = (item: PopulatedItem | null) => item?.unit?.code || item?.unit?.name || '';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const [adjustments, purchases, transfers, sales] = await Promise.all([
    StockAdjustment.find()
      .populate({ path: 'item', populate: { path: 'unit', select: 'code name' } })
      .populate({ path: 'location', select: 'name' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Purchase.find({ status: 'Received' })
      .populate({ path: 'item', populate: { path: 'unit', select: 'code name' } })
      .populate({ path: 'location', select: 'name' })
      .sort({ receivedAt: -1, createdAt: -1 })
      .limit(5)
      .lean(),
    StockTransfer.find({ status: 'Completed' })
      .populate({ path: 'item', populate: { path: 'unit', select: 'code name' } })
      .populate({ path: 'fromLocation toLocation', select: 'name' })
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(5)
      .lean(),
    Sale.find()
      .populate({ path: 'location', select: 'name' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const activities: RecentInventoryActivity[] = [
    ...adjustments.map((adjustment) => {
      const item = getPopulatedItem(adjustment.item);
      const location = getPopulatedLocation(adjustment.location);
      const unit = unitCode(item);
      const quantity = adjustment.type === 'Add'
        ? `+${adjustment.qty}`
        : adjustment.type === 'Subtract'
          ? `-${adjustment.qty}`
          : `Set to ${adjustment.qty}`;
      const details = [
        `${adjustment.type} adjustment`,
        location?.name || 'Location unavailable',
        adjustment.reason,
        adjustment.refNo,
      ].filter(Boolean);

      return {
        id: `adjustment:${getId(adjustment._id)}`,
        kind: 'adjustment' as const,
        title: itemLabel(item),
        description: details.join(' · '),
        quantityLabel: `${quantity}${unit ? ` ${unit}` : ''}`,
        createdAt: adjustment.createdAt.toISOString(),
      };
    }),
    ...purchases.map((purchase) => {
      const item = getPopulatedItem(purchase.item);
      const location = getPopulatedLocation(purchase.location);
      const unit = unitCode(item);
      const details = [
        'Purchase received',
        location?.name || 'Location unavailable',
        purchase.reference,
      ].filter(Boolean);

      return {
        id: `purchase:${getId(purchase._id)}`,
        kind: 'purchase' as const,
        title: itemLabel(item),
        description: details.join(' · '),
        quantityLabel: `+${purchase.qty}${unit ? ` ${unit}` : ''}`,
        createdAt: (purchase.receivedAt || purchase.createdAt || purchase.purchaseDate).toISOString(),
      };
    }),
    ...transfers.map((transfer) => {
      const item = getPopulatedItem(transfer.item);
      const fromLocation = getPopulatedLocation(transfer.fromLocation);
      const toLocation = getPopulatedLocation(transfer.toLocation);
      const unit = unitCode(item);

      return {
        id: `transfer:${getId(transfer._id)}`,
        kind: 'transfer' as const,
        title: itemLabel(item),
        description: `Transfer received · ${fromLocation?.name || 'Unknown'} → ${toLocation?.name || 'Unknown'}`,
        quantityLabel: `${transfer.qty}${unit ? ` ${unit}` : ''}`,
        createdAt: (transfer.completedAt || transfer.createdAt).toISOString(),
      };
    }),
    ...sales.map((sale) => {
      const location = getPopulatedLocation(sale.location);
      return {
        id: `sale:${getId(sale._id)}`,
        kind: 'sale' as const,
        title: `Receipt ${sale.receiptNo}`,
        description: `POS sale · ${location?.name || 'Location unavailable'}`,
        quantityLabel: `${sale.items.length} item${sale.items.length === 1 ? '' : 's'}`,
        createdAt: sale.createdAt.toISOString(),
      };
    }),
  ];

  return NextResponse.json(getRecentInventoryActivity(activities));
});

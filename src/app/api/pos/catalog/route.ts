import { NextResponse } from 'next/server';
import CashierCredential from '@/models/CashierCredential';
import Employee from '@/models/Employee';
import Item from '@/models/Item';
import Location from '@/models/Location';
import StockBalance from '@/models/StockBalance';
import '@/models/Unit';
import { connectToDatabase } from '@/lib/mongoose';
import { getPosCashierSession } from '@/lib/pos-auth';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async (request: Request) => {
  const cashierSession = getPosCashierSession(request);
  if (!cashierSession) {
    return NextResponse.json({ error: 'Cashier sign-in required.' }, { status: 401 });
  }

  await connectToDatabase();
  const [employee, credential] = await Promise.all([
    Employee.exists({ _id: cashierSession.employeeId, isActive: true }),
    CashierCredential.exists({
      employee: cashierSession.employeeId,
      sessionVersion: cashierSession.sessionVersion,
    }),
  ]);
  if (!employee || !credential) {
    return NextResponse.json({ error: 'Cashier sign-in required.' }, { status: 401 });
  }

  const [items, locations] = await Promise.all([
    Item.find({ $or: [{ isActive: true }, { isActive: { $exists: false } }] })
      .select('_id sku name icon sellingPrice unit isActive')
      .populate('unit', 'name code')
      .sort({ sku: 1 })
      .lean(),
    Location.find().select('_id name code').sort({ name: 1 }).lean(),
  ]);
  const itemIds = items.map((item) => item._id);
  const balances = itemIds.length
    ? await StockBalance.find({ item: { $in: itemIds }, quantity: { $gt: 0 } })
      .select('item location quantity')
      .lean()
    : [];

  return NextResponse.json({
    items: items.map((item) => ({ ...item, isActive: item.isActive !== false })),
    locations,
    balances: balances.map((balance) => ({
      itemId: String(balance.item),
      locationId: String(balance.location),
      quantity: balance.quantity,
    })),
  });
});

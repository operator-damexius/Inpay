import mongoose, { type FilterQuery } from 'mongoose';
import { NextResponse } from 'next/server';
import AppSettings from '@/models/AppSettings';
import CashierCredential from '@/models/CashierCredential';
import Employee from '@/models/Employee';
import Item from '@/models/Item';
import Ledger from '@/models/Ledger';
import Location from '@/models/Location';
import Sale, { type ISale } from '@/models/Sale';
import StockBalance from '@/models/StockBalance';
import { connectToDatabase } from '@/lib/mongoose';
import { removeStock } from '@/lib/stock-balances';
import { getPosCashierSession } from '@/lib/pos-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export const GET = withErrorHandler(async (request: Request) => {
  const cashierSession = getPosCashierSession(request);
  if (!cashierSession) return NextResponse.json({ error: 'Cashier sign-in required.' }, { status: 401 });

  await connectToDatabase();
  const [credential, activeCashier] = await Promise.all([
    CashierCredential.exists({
      employee: cashierSession.employeeId,
      sessionVersion: cashierSession.sessionVersion,
    }),
    Employee.exists({ _id: cashierSession.employeeId, isActive: true }),
  ]);
  if (!credential || !activeCashier) {
    return NextResponse.json({ error: 'Cashier sign-in required.' }, { status: 401 });
  }
  const searchParams = new URL(request.url).searchParams;
  const search = (searchParams.get('q') || '').trim();
  const page = Number(searchParams.get('page') || 1);
  const pageSize = 25;
  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError('Page must be a positive whole number.', 400);
  }
  if (search.length > 100) {
    throw new ApiError('Search must be 100 characters or fewer.', 400);
  }

  const filter: FilterQuery<ISale> = {};
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escapedSearch, 'i');
    const locationIds = await Location.find({ name: pattern }).distinct('_id');
    filter.$or = [
      { receiptNo: pattern },
      { customer: pattern },
      { cashierName: pattern },
      { paymentMethod: pattern },
      { location: { $in: locationIds } },
    ];
  }

  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate('location', 'name code')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Sale.countDocuments(filter),
  ]);
  return NextResponse.json({ sales, total, page, pageSize });
});

export const POST = withErrorHandler(async (request: Request) => {
  const cashierSession = getPosCashierSession(request);
  if (!cashierSession) return NextResponse.json({ error: 'Cashier sign-in required.' }, { status: 401 });
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const body = await request.json();
  const locationId = typeof body.locationId === 'string' ? body.locationId : '';
  const customer = typeof body.customer === 'string' && body.customer.trim()
    ? body.customer.trim()
    : 'Walk-in';
  const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : '';
  if (!mongoose.isValidObjectId(locationId)) {
    throw new ApiError('Choose a valid stock location.', 400);
  }
  if (customer.length > 160) throw new ApiError('Customer name must be 160 characters or fewer.', 400);
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    throw new ApiError('Add between 1 and 100 items to the sale.', 400);
  }

  const quantities = new Map<string, number>();
  for (const line of body.items) {
    if (!line || typeof line.itemId !== 'string' || !mongoose.isValidObjectId(line.itemId)) {
      throw new ApiError('The sale contains an invalid item.', 400);
    }
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError('Every item quantity must be greater than zero.', 400);
    }
    const itemId = line.itemId;
    quantities.set(itemId, (quantities.get(itemId) || 0) + quantity);
  }

  await connectToDatabase();
  const settings = await AppSettings.findOne({ key: 'global' });
  const precision = settings?.posQuantityPrecision ?? 2;
  const scale = 10 ** precision;
  for (const quantity of quantities.values()) {
    if (Math.abs(quantity * scale - Math.round(quantity * scale)) > 1e-8) {
      throw new ApiError(`Quantities must use no more than ${precision} decimal places.`, 400);
    }
  }
  const paymentMethods = settings?.posPaymentMethods?.length
    ? settings.posPaymentMethods
    : ['cash', 'gcash', 'bank_transfer', 'card'];
  if (!paymentMethods.includes(paymentMethod)) {
    throw new ApiError('Choose an enabled payment method.', 400);
  }

  const session = await mongoose.startSession();
  let saleId = '';
  try {
    await session.withTransaction(async () => {
      const cashier = await Employee.findOne({
        _id: cashierSession.employeeId,
        isActive: true,
      }).session(session);
      const credential = await CashierCredential.findOne({
        employee: cashierSession.employeeId,
        sessionVersion: cashierSession.sessionVersion,
      }).session(session);
      if (!cashier || !credential) throw new ApiError('Cashier session is no longer active.', 401);
      const location = await Location.findById(locationId).session(session);
      if (!location) throw new ApiError('The selected location no longer exists.', 400);

      const itemIds = [...quantities.keys()];
      const items = await Item.find({
        _id: { $in: itemIds },
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      })
        .populate('unit', 'name code')
        .session(session);
      if (items.length !== itemIds.length) {
        throw new ApiError('One or more items are inactive or no longer available.', 409);
      }

      const saleLines = [];
      let subtotal = 0;
      let cogsTotal = 0;
      for (const item of items) {
        const quantity = quantities.get(item._id.toString());
        if (quantity === undefined) continue;
        const unitPrice = Number(item.sellingPrice);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
          throw new ApiError(`A valid selling price is not set for ${item.name}.`, 409);
        }

        const removed = await removeStock(item._id, location._id, quantity, session);
        if (!removed) {
          const balance = await StockBalance.findOne({
            item: item._id,
            location: location._id,
          }).session(session);
          throw new ApiError(`Not enough stock for ${item.name} at ${location.name}. Available: ${balance?.quantity ?? 0}.`, 409);
        }
        if (removed.cogsEligibleQuantity > 0) {
          const unitCost = Number(item.price);
          if (!Number.isFinite(unitCost) || unitCost < 0) {
            throw new ApiError(`A valid inventory cost is not set for ${item.name}.`, 409);
          }
          cogsTotal = roundCurrency(cogsTotal + removed.cogsEligibleQuantity * unitCost);
        }
        const stockUpdate = await Item.updateOne(
          { _id: item._id, stockOnHand: { $gte: quantity } },
          { $inc: { stockOnHand: -quantity } },
          { session }
        );
        if (stockUpdate.modifiedCount !== 1) {
          throw new ApiError(`Stock changed for ${item.name}; refresh and try again.`, 409);
        }

        const lineTotal = roundCurrency(quantity * unitPrice);
        subtotal = roundCurrency(subtotal + lineTotal);
        if (!Number.isFinite(lineTotal) || !Number.isFinite(subtotal)) {
          throw new ApiError(`Sale total is outside the supported range for ${item.name}.`, 400);
        }
        const unit = item.unit && typeof item.unit === 'object'
          ? ('code' in item.unit ? String(item.unit.code) : 'name' in item.unit ? String(item.unit.name) : '')
          : '';
        saleLines.push({
          item: item._id,
          sku: item.sku,
          name: item.name,
          unit,
          quantity,
          unitPrice,
          lineTotal,
        });
      }

      const saleObjectId = new mongoose.Types.ObjectId();
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const receiptNo = `POS-${datePart}-${saleObjectId.toString().slice(-8).toUpperCase()}`;
      const [sale] = await Sale.create([{
        _id: saleObjectId,
        receiptNo,
        cashier: cashier._id,
        cashierName: `${cashier.firstname} ${cashier.lastname}`,
        businessName: settings?.businessName || 'Inpay',
        businessAddress: settings?.businessAddress || '',
        businessPhone: settings?.businessPhone || '',
        location: location._id,
        customer,
        paymentMethod,
        items: saleLines,
        subtotal,
        tax: 0,
        total: subtotal,
      }], { session });
      const lastLedgerEntry = await Ledger.findOne({}, { balance: 1 })
        .sort({ date: -1, createdAt: -1 })
        .session(session);
      const currentBalance = lastLedgerEntry?.balance ?? 0;
      await Ledger.create([{
        type: 'item',
        pnlCategory: 'sales_income',
        reference: receiptNo,
        description: `POS sale at ${location.name} (${paymentMethod})`,
        amount: subtotal,
        balance: currentBalance + subtotal,
        date: sale.createdAt,
        createdBy: `${cashier.firstname} ${cashier.lastname}`,
      }], { session });
      if (cogsTotal > 0) {
        await Ledger.create([{
          type: 'item',
          pnlCategory: 'cost_of_goods_sold',
          reference: `COGS-${receiptNo}`,
          description: `Cost of goods sold for ${receiptNo}`,
          amount: -cogsTotal,
          balance: currentBalance + subtotal - cogsTotal,
          date: sale.createdAt,
          createdBy: `${cashier.firstname} ${cashier.lastname}`,
          createdAt: new Date(sale.createdAt.getTime() + 1),
        }], { session });
      }
      saleId = sale._id.toString();
    });
  } finally {
    await session.endSession();
  }

  if (!saleId) throw new ApiError('Sale was not completed.', 500);
  const sale = await Sale.findById(saleId).populate('location', 'name code').lean();
  if (!sale) throw new ApiError('Completed sale could not be loaded.', 500);
  return NextResponse.json(sale, { status: 201 });
});

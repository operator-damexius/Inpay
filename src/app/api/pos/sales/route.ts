import mongoose, { type FilterQuery } from 'mongoose';
import { NextResponse } from 'next/server';
import AppSettings from '@/models/AppSettings';
import CashierCredential from '@/models/CashierCredential';
import Employee from '@/models/Employee';
import Item from '@/models/Item';
import { ensureDefaultLedgerAccounts, getDefaultAccountCodeForPaymentMethod, initializeLedgerAccounting, postJournalEntry } from '@/lib/ledger-accounting';
import Location from '@/models/Location';
import '@/models/Unit';
import Sale, { type ISale } from '@/models/Sale';
import type { IJournalLine } from '@/models/JournalEntry';
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

  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null) throw new ApiError('Enter valid sale details.', 400);
  const values = body as Record<string, unknown>;
  const idempotencyKey = typeof values.idempotencyKey === 'string' ? values.idempotencyKey.trim() : '';
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) {
    throw new ApiError('A valid checkout idempotency key is required.', 400);
  }
  const locationId = typeof values.locationId === 'string' ? values.locationId : '';
  const customer = typeof values.customer === 'string' && values.customer.trim()
    ? values.customer.trim()
    : 'Walk-in';
  const paymentMethod = typeof values.paymentMethod === 'string' ? values.paymentMethod : '';
  if (!mongoose.isValidObjectId(locationId)) {
    throw new ApiError('Choose a valid stock location.', 400);
  }
  if (customer.length > 160) throw new ApiError('Customer name must be 160 characters or fewer.', 400);
  if (!Array.isArray(values.items) || values.items.length === 0 || values.items.length > 100) {
    throw new ApiError('Add between 1 and 100 items to the sale.', 400);
  }

  const quantities = new Map<string, number>();
  for (const line of values.items) {
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

  await Promise.all([initializeLedgerAccounting(), Sale.init()]);
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
      const existingSale = await Sale.findOne({ idempotencyKey }).session(session);
      if (existingSale) {
        if (existingSale.cashier.toString() !== cashier._id.toString()) {
          throw new ApiError('This checkout key belongs to a different cashier.', 409);
        }
        saleId = existingSale._id.toString();
        return;
      }
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
        idempotencyKey,
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
      const accounts = await ensureDefaultLedgerAccounts(session);
      const paymentAccount = accounts.get(getDefaultAccountCodeForPaymentMethod(paymentMethod));
      const salesAccount = accounts.get('SALES');
      const inventoryAccount = accounts.get('INVENTORY');
      const cogsAccount = accounts.get('COGS');
      if (!paymentAccount || !salesAccount || !inventoryAccount || !cogsAccount) {
        throw new ApiError('Default ledger accounts are not available.', 500);
      }
      const lines: IJournalLine[] = [
        { account: paymentAccount._id, debit: sale.total, credit: 0 },
        { account: salesAccount._id, debit: 0, credit: sale.subtotal, pnlCategory: 'sales_income' as const },
      ];
      if (sale.tax > 0) {
        const taxAccount = accounts.get('SALES_TAX_PAYABLE');
        if (!taxAccount) throw new ApiError('Sales tax account is not available.', 500);
        lines.push({
          account: taxAccount._id,
          debit: 0,
          credit: sale.tax,
          pnlCategory: 'unclassified' as const,
        });
      }
      if (cogsTotal > 0) {
        lines.push(
          { account: cogsAccount._id, debit: cogsTotal, credit: 0, pnlCategory: 'cost_of_goods_sold' as const },
          { account: inventoryAccount._id, debit: 0, credit: cogsTotal }
        );
      }
      await postJournalEntry({
        sourceKey: `pos-sale:${sale._id.toString()}`,
        sourceType: 'pos-sale',
        reference: receiptNo,
        description: `POS sale at ${location.name} (${paymentMethod})`,
        date: sale.createdAt,
        lines,
        createdBy: `${cashier.firstname} ${cashier.lastname}`,
      }, session);
      saleId = sale._id.toString();
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      const existingSale = await Sale.findOne({ idempotencyKey });
      if (existingSale && existingSale.cashier.toString() === cashierSession.employeeId) {
        saleId = existingSale._id.toString();
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  if (!saleId) throw new ApiError('Sale was not completed.', 500);
  const sale = await Sale.findById(saleId).populate('location', 'name code').lean();
  if (!sale) throw new ApiError('Completed sale could not be loaded.', 500);
  return NextResponse.json(sale, { status: 201 });
});

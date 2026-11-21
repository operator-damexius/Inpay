import { NextResponse } from 'next/server';
import CashierCredential from '@/models/CashierCredential';
import Employee from '@/models/Employee';
import '@/models/Location';
import Sale, { type ISale } from '@/models/Sale';
import { connectToDatabase } from '@/lib/mongoose';
import { getPosCashierSession } from '@/lib/pos-auth';
import { withErrorHandler } from '@/lib/api-handler';
import { csvCell } from '@/lib/pos-sales-csv';

type SaleCsvRecord = Omit<ISale, 'location'> & { location?: { name?: string } | null };

function isSaleCsvRecord(value: unknown): value is SaleCsvRecord {
  if (typeof value !== 'object' || value === null) return false;
  const sale = value as Record<string, unknown>;
  const locationIsValid = sale.location == null ||
    (typeof sale.location === 'object' &&
      ('name' in sale.location === false || typeof sale.location.name === 'string'));
  const itemsAreValid = Array.isArray(sale.items) && sale.items.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false;
    const line = item as Record<string, unknown>;
    return typeof line.sku === 'string' &&
      typeof line.name === 'string' &&
      typeof line.quantity === 'number' &&
      typeof line.unitPrice === 'number' &&
      typeof line.lineTotal === 'number';
  });

  return typeof sale.receiptNo === 'string' &&
    (sale.createdAt instanceof Date || typeof sale.createdAt === 'string') &&
    typeof sale.customer === 'string' &&
    typeof sale.cashierName === 'string' &&
    locationIsValid &&
    typeof sale.paymentMethod === 'string' &&
    typeof sale.subtotal === 'number' &&
    typeof sale.tax === 'number' &&
    typeof sale.total === 'number' &&
    itemsAreValid;
}

function saleToCsvRow(sale: SaleCsvRecord) {
  const createdAt = sale.createdAt instanceof Date
    ? sale.createdAt.toISOString()
    : new Date(sale.createdAt).toISOString();
  const itemSummary = sale.items.map((item) =>
    `${item.sku} ${item.name} x${item.quantity} @${item.unitPrice} = ${item.lineTotal}`
  ).join('; ');
  return [
    sale.receiptNo,
    createdAt,
    sale.customer,
    sale.cashierName,
    sale.location?.name || '',
    sale.paymentMethod,
    sale.subtotal,
    sale.tax,
    sale.total,
    itemSummary,
  ].map(csvCell).join(',');
}

export const GET = withErrorHandler(async (request: Request) => {
  const cashierSession = getPosCashierSession(request);
  if (!cashierSession) {
    return NextResponse.json({ error: 'Cashier sign-in required.' }, { status: 401 });
  }

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

  const cursor = Sale.find()
    .select('receiptNo createdAt customer cashierName location paymentMethod subtotal tax total items')
    .populate('location', 'name')
    .sort({ createdAt: -1 })
    .lean()
    .cursor();
  const iterator = cursor[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(
        '\uFEFFReceipt,Date,Customer,Cashier,Location,Payment Method,Subtotal,Tax,Total,Items\r\n'
      ));
    },
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) {
          controller.close();
          await cursor.close();
          return;
        }
        if (!isSaleCsvRecord(value)) throw new Error('A POS sale has invalid export data.');
        controller.enqueue(encoder.encode(`${saleToCsvRow(value)}\r\n`));
      } catch (error) {
        await cursor.close();
        controller.error(error);
      }
    },
    async cancel() {
      await cursor.close();
    },
  });
  const filename = `pos-sales-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});

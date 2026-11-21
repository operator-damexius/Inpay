import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import Sale from '@/models/Sale';
import CashierCredential from '@/models/CashierCredential';
import Employee from '@/models/Employee';
import { connectToDatabase } from '@/lib/mongoose';
import { getPosCashierSession } from '@/lib/pos-auth';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const cashierSession = getPosCashierSession(request);
  if (!cashierSession) {
    return NextResponse.json({ error: 'Cashier sign-in required.' }, { status: 401 });
  }
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError('Invalid sale receipt.', 400);
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
  const sale = await Sale.findById(id).populate('location', 'name code').lean();
  if (!sale) throw new ApiError('Sale receipt not found.', 404);
  return NextResponse.json(sale);
});

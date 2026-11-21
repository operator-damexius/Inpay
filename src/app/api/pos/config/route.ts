import { NextResponse } from 'next/server';
import AppSettings from '@/models/AppSettings';
import CashierCredential from '@/models/CashierCredential';
import Employee from '@/models/Employee';
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
  const settings = await AppSettings.findOne({ key: 'global' });
  return NextResponse.json({
    businessName: settings?.businessName || 'Inpay',
    paymentMethods: settings?.posPaymentMethods?.length
      ? settings.posPaymentMethods
      : ['cash', 'gcash', 'bank_transfer', 'card'],
    quantityPrecision: settings?.posQuantityPrecision ?? 2,
    taxEnabled: false,
  });
});

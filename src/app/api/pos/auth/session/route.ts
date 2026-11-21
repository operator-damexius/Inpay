import { NextResponse } from 'next/server';
import Employee from '@/models/Employee';
import CashierCredential from '@/models/CashierCredential';
import { connectToDatabase } from '@/lib/mongoose';
import { getPosCashierSession } from '@/lib/pos-auth';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async (request: Request) => {
  const cashierSession = getPosCashierSession(request);
  if (!cashierSession) return NextResponse.json({ cashier: null });

  await connectToDatabase();
  const [employee, credential] = await Promise.all([
    Employee.findOne({ _id: cashierSession.employeeId, isActive: true })
      .select('_id employeeNo firstname lastname'),
    CashierCredential.findOne({
      employee: cashierSession.employeeId,
      sessionVersion: cashierSession.sessionVersion,
    }).select('_id'),
  ]);
  if (!employee || !credential) return NextResponse.json({ cashier: null });
  return NextResponse.json({
    cashier: {
      _id: employee._id,
      employeeNo: employee.employeeNo,
      name: `${employee.firstname} ${employee.lastname}`,
    },
  });
});

import { NextResponse } from 'next/server';
import EmployeeAccount from '@/models/EmployeeAccount';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const accounts = await EmployeeAccount.find().sort({ employeeNo: 1 }).lean();
  return NextResponse.json(accounts);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();

  const account = await EmployeeAccount.create({
    employee: body.employeeId,
    employeeNo: body.employeeNo,
    firstname: body.firstname,
    lastname: body.lastname,
    balance: parseFloat(body.balance || 0),
    isActive: body.isActive !== false,
  });

  return NextResponse.json(account, { status: 201 });
});

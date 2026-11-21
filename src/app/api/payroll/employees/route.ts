import { NextResponse } from 'next/server';
import Employee from '@/models/Employee';
import CashierCredential from '@/models/CashierCredential';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const employees = await Employee.find().sort({ employeeNo: 1 }).lean();
  const cashierIds = new Set(
    (await CashierCredential.find().select('employee').lean()).map((credential) =>
      credential.employee.toString()
    )
  );
  return NextResponse.json(employees.map((employee) => ({
    ...employee,
    hasPosPin: cashierIds.has(String(employee._id)),
  })));
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const employee = await Employee.create({
    employeeNo: body.employeeNo,
    firstname: body.firstname,
    lastname: body.lastname,
    shift: body.shift || '1st',
    ratePerDay: parseFloat(body.ratePerDay || 0),
    dateHired: body.dateHired || null,
    isActive: body.isActive !== false,
  });
  return NextResponse.json(employee, { status: 201 });
});

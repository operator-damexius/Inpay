import { NextResponse } from 'next/server';
import Employee from '@/models/Employee';
import CashierCredential from '@/models/CashierCredential';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

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
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Employee request is invalid.', 400);
  }
  const employeeNo = typeof body?.employeeNo === 'string' ? body.employeeNo.trim() : '';
  const firstname = typeof body?.firstname === 'string' ? body.firstname.trim() : '';
  const lastname = typeof body?.lastname === 'string' ? body.lastname.trim() : '';
  const shift = typeof body?.shift === 'string' ? body.shift.trim() : '1st';
  const ratePerDay = Number(body?.ratePerDay);
  if (!employeeNo || !firstname || !lastname || !shift) {
    throw new ApiError('Employee number, name, and shift are required.', 400);
  }
  if (!Number.isFinite(ratePerDay) || ratePerDay <= 0) {
    throw new ApiError('Enter a positive daily rate.', 400);
  }
  if (await Employee.exists({ employeeNo })) {
    throw new ApiError('An employee with this number already exists.', 409);
  }

  const dateHired = body.dateHired ? new Date(body.dateHired) : null;
  if (dateHired && !Number.isFinite(dateHired.getTime())) {
    throw new ApiError('Enter a valid hire date.', 400);
  }

  const employee = await Employee.create({
    employeeNo,
    firstname,
    lastname,
    shift,
    ratePerDay,
    dateHired,
    isActive: body.isActive !== false,
  });
  return NextResponse.json(employee, { status: 201 });
});

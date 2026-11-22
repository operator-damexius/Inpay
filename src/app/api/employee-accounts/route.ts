import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Employee from '@/models/Employee';
import EmployeeAccount from '@/models/EmployeeAccount';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const accounts = await EmployeeAccount.find().sort({ employeeNo: 1 }).lean();
  const employees = await Employee.find({
    _id: { $in: accounts.map((account) => account.employee) },
  })
    .select('employeeNo firstname lastname')
    .lean();
  const employeesById = new Map(employees.map((employee) => [String(employee._id), employee]));
  return NextResponse.json(accounts.map((account) => {
    const employee = employeesById.get(String(account.employee));
    return {
      ...account,
      employeeNo: employee?.employeeNo ?? account.employeeNo,
      firstname: employee?.firstname ?? account.firstname,
      lastname: employee?.lastname ?? account.lastname,
    };
  }));
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Employee account request is invalid.', 400);
  }
  if (!mongoose.isValidObjectId(body.employeeId)) {
    throw new ApiError('Choose a valid employee.', 400);
  }
  const employee = await Employee.findById(body.employeeId);
  if (!employee) {
    throw new ApiError('Employee not found.', 404);
  }
  const balance = body.balance === '' || body.balance === undefined || body.balance === null
    ? 0
    : Number(body.balance);
  if (!Number.isFinite(balance)) {
    throw new ApiError('Enter a valid opening balance.', 400);
  }
  if (await EmployeeAccount.exists({ employee: employee._id })) {
    throw new ApiError('An account already exists for this employee.', 409);
  }

  const account = await EmployeeAccount.create({
    employee: employee._id,
    employeeNo: employee.employeeNo,
    firstname: employee.firstname,
    lastname: employee.lastname,
    balance,
    isActive: body.isActive !== false,
  });

  return NextResponse.json(account, { status: 201 });
});

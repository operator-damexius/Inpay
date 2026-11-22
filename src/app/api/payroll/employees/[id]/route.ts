import { NextResponse } from 'next/server';
import Employee from '@/models/Employee';
import Attendance from '@/models/Attendance';
import EmployeeAccount from '@/models/EmployeeAccount';
import PayrollDetail from '@/models/PayrollDetail';
import CashierCredential from '@/models/CashierCredential';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid employee.', 400);
  }
  await connectToDatabase();
  const body = await req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Employee update is invalid.', 400);
  }
  const employeeNo = typeof body.employeeNo === 'string' ? body.employeeNo.trim() : '';
  const firstname = typeof body.firstname === 'string' ? body.firstname.trim() : '';
  const lastname = typeof body.lastname === 'string' ? body.lastname.trim() : '';
  const shift = typeof body.shift === 'string' ? body.shift.trim() : '';
  const ratePerDay = Number(body.ratePerDay);
  if (!employeeNo || !firstname || !lastname || !shift) {
    throw new ApiError('Employee number, name, and shift are required.', 400);
  }
  if (!Number.isFinite(ratePerDay) || ratePerDay <= 0) {
    throw new ApiError('Enter a positive daily rate.', 400);
  }
  if (await Employee.exists({ employeeNo, _id: { $ne: id } })) {
    throw new ApiError('An employee with this number already exists.', 409);
  }

  const update: {
    employeeNo: string;
    firstname: string;
    lastname: string;
    shift: string;
    ratePerDay: number;
    isActive: boolean;
    dateHired?: Date | null;
  } = {
    employeeNo,
    firstname,
    lastname,
    shift,
    ratePerDay,
    isActive: body.isActive !== false,
  };
  if ('dateHired' in body) {
    const dateHired = body.dateHired ? new Date(body.dateHired) : null;
    if (dateHired && !Number.isFinite(dateHired.getTime())) {
      throw new ApiError('Enter a valid hire date.', 400);
    }
    update.dateHired = dateHired;
  }

  const employee = await Employee.findByIdAndUpdate(
    id,
    update,
    { new: true, runValidators: true }
  );
  if (!employee) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(employee);
});

export const DELETE = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid employee.', 400);
  }
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const employee = await Employee.findById(id).session(session);
      if (!employee) {
        throw new ApiError('Employee not found.', 404);
      }

      const [hasAttendance, hasPayrollDetails, hasAccount] = await Promise.all([
        Attendance.exists({ employee: id }).session(session),
        PayrollDetail.exists({ employee: id }).session(session),
        EmployeeAccount.exists({ employee: id }).session(session),
      ]);
      if (hasAttendance || hasPayrollDetails || hasAccount) {
        throw new ApiError(
          'This employee has attendance, payroll, or account history. Deactivate the employee instead of deleting it.',
          409
        );
      }

      await CashierCredential.deleteOne({ employee: id }, { session });
      await employee.deleteOne({ session });
    });
  } finally {
    await session.endSession();
  }
  return NextResponse.json({ ok: true });
});

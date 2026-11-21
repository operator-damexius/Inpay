import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import CashierCredential from '@/models/CashierCredential';
import Employee from '@/models/Employee';
import { connectToDatabase } from '@/lib/mongoose';
import { hashCashierPin } from '@/lib/pos-auth';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const PUT = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) => {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { employeeId } = await params;
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new ApiError('Select a valid employee.', 400);
  }
  const body = await request.json();
  if (typeof body.pin !== 'string' || !/^\d{6}$/.test(body.pin)) {
    throw new ApiError('Cashier PIN must be exactly 6 digits.', 400);
  }

  await connectToDatabase();
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new ApiError('Employee not found.', 404);
  if (!employee.isActive) throw new ApiError('Only active employees can be cashiers.', 400);

  const { salt, hash } = hashCashierPin(body.pin);
  await CashierCredential.findOneAndUpdate(
    { employee: employee._id },
    {
      employee: employee._id,
      pinSalt: salt,
      pinHash: hash,
      sessionVersion: randomBytes(16).toString('hex'),
      failedAttempts: 0,
      lockedUntil: null,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return NextResponse.json({ ok: true });
});

export const DELETE = withErrorHandler(async (
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) => {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const { employeeId } = await params;
  if (!mongoose.isValidObjectId(employeeId)) {
    throw new ApiError('Select a valid employee.', 400);
  }
  await connectToDatabase();
  await CashierCredential.deleteOne({ employee: employeeId });
  return NextResponse.json({ ok: true });
});

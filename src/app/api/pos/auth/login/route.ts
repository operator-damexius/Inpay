import { NextResponse } from 'next/server';
import Employee from '@/models/Employee';
import CashierCredential from '@/models/CashierCredential';
import { connectToDatabase } from '@/lib/mongoose';
import {
  createPosSession,
  isPosAuthConfigured,
  POS_SESSION_COOKIE,
  POS_SESSION_MAX_AGE,
  verifyCashierPin,
} from '@/lib/pos-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const POST = withErrorHandler(async (request: Request) => {
  if (!isPosAuthConfigured()) {
    return NextResponse.json({ error: 'POS cashier sign-in is not configured. Set ADMIN_SESSION_SECRET first.' }, { status: 503 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const body = await request.json();
  const employeeNo = typeof body.employeeNo === 'string' ? body.employeeNo.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  if (!employeeNo || !/^\d{6}$/.test(pin)) {
    throw new ApiError('Enter your employee number and 6-digit PIN.', 400);
  }

  await connectToDatabase();
  const employee = await Employee.findOne({ employeeNo, isActive: true }).select('_id employeeNo firstname lastname');
  const credential = employee
    ? await CashierCredential.findOne({ employee: employee._id })
    : null;
  if (!employee || !credential) {
    return NextResponse.json({ error: 'Invalid employee number or PIN.' }, { status: 401 });
  }
  if (credential.lockedUntil && credential.lockedUntil > new Date()) {
    return NextResponse.json({ error: 'Too many failed attempts. Try again later.' }, { status: 429 });
  }

  if (!verifyCashierPin(pin, credential.pinSalt, credential.pinHash)) {
    const failedAttempts = credential.failedAttempts + 1;
    await CashierCredential.updateOne(
      { _id: credential._id },
      failedAttempts >= 5
        ? { $set: { failedAttempts: 0, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } }
        : { $inc: { failedAttempts: 1 } }
    );
    return NextResponse.json({ error: 'Invalid employee number or PIN.' }, { status: 401 });
  }

  await CashierCredential.updateOne(
    { _id: credential._id },
    { $set: { failedAttempts: 0, lockedUntil: null } }
  );
  const response = NextResponse.json({
    cashier: {
      _id: employee._id,
      employeeNo: employee.employeeNo,
      name: `${employee.firstname} ${employee.lastname}`,
    },
  });
  response.cookies.set(
    POS_SESSION_COOKIE,
    createPosSession(employee._id.toString(), credential.sessionVersion),
    {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: POS_SESSION_MAX_AGE,
    }
  );
  return response;
});

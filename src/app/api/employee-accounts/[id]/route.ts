import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import EmployeeAccount from '@/models/EmployeeAccount';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid employee account.', 400);
  }
  await connectToDatabase();
  const body = await req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Employee account update is invalid.', 400);
  }
  const balance = body.balance === '' || body.balance === undefined || body.balance === null
    ? 0
    : Number(body.balance);
  if (!Number.isFinite(balance)) {
    throw new ApiError('Enter a valid balance.', 400);
  }
  if (typeof body.isActive !== 'boolean') {
    throw new ApiError('Choose whether the account is active.', 400);
  }
  const account = await EmployeeAccount.findByIdAndUpdate(
    id,
    {
      balance,
      isActive: body.isActive,
      updatedAt: new Date(),
    },
    { new: true }
  );
  if (!account) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(account);
});

export const DELETE = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid employee account.', 400);
  }
  await connectToDatabase();
  const account = await EmployeeAccount.findById(id);
  if (!account) {
    throw new ApiError('Employee account not found.', 404);
  }
  if (account.balance !== 0) {
    throw new ApiError('Settle the account balance or deactivate this account before deleting it.', 409);
  }
  await account.deleteOne();
  return NextResponse.json({ ok: true });
});

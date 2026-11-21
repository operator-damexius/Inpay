import { NextResponse } from 'next/server';
import EmployeeAccount from '@/models/EmployeeAccount';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const PUT = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await connectToDatabase();
  const body = await req.json();
  const account = await EmployeeAccount.findByIdAndUpdate(
    id,
    {
      balance: parseFloat(body.balance || 0),
      isActive: body.isActive !== false,
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
  await connectToDatabase();
  await EmployeeAccount.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
});

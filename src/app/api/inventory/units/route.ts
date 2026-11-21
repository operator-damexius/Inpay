import { NextResponse } from 'next/server';
import Unit from '@/models/Unit';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const units = await Unit.find().sort({ name: 1 }).lean();
  return NextResponse.json(units);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!name || !code) throw new ApiError('Unit name and code are required.', 400);
  if (await Unit.exists({ code })) throw new ApiError('A unit with this code already exists.', 409);

  const unit = await Unit.create({ name, code });
  return NextResponse.json(unit, { status: 201 });
});

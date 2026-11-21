import { NextResponse } from 'next/server';
import Location from '@/models/Location';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const locs = await Location.find().sort({ name: 1 }).lean();
  return NextResponse.json(locs);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const loc = await Location.create({ name: body.name, code: body.code });
  return NextResponse.json(loc, { status: 201 });
});

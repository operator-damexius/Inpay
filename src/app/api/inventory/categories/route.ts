import { NextResponse } from 'next/server';
import Category from '@/models/Category';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const cats = await Category.find().sort({ name: 1 }).lean();
  return NextResponse.json(cats);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const cat = await Category.create({ name: body.name });
  return NextResponse.json(cat, { status: 201 });
});

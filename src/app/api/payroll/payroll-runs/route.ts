import { NextResponse } from 'next/server';
import PayrollRun from '@/models/PayrollRun';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const runs = await PayrollRun.find().sort({ periodStart: -1 }).lean();
  return NextResponse.json(runs);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const run = await PayrollRun.create({
    periodStart: new Date(body.periodStart),
    periodEnd: new Date(body.periodEnd),
    status: 'Open',
  });
  return NextResponse.json(run, { status: 201 });
});

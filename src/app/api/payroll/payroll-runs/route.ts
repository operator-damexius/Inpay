import { NextResponse } from 'next/server';
import PayrollRun from '@/models/PayrollRun';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { parsePayrollPeriod } from '@/lib/payroll-period';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const runs = await PayrollRun.find().sort({ periodStart: -1 }).lean();
  return NextResponse.json(runs);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  let period: ReturnType<typeof parsePayrollPeriod>;
  try {
    period = parsePayrollPeriod(body?.periodStart, body?.periodEnd);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new ApiError(error.message, 400);
    }
    throw error;
  }

  const overlappingRun = await PayrollRun.findOne({
    periodStart: { $lte: period.end },
    periodEnd: { $gte: period.start },
  });
  if (overlappingRun) {
    throw new ApiError('This period overlaps an existing payroll run.', 409);
  }

  const run = await PayrollRun.create({
    periodStart: period.start,
    periodEnd: period.end,
    status: 'Open',
  });
  return NextResponse.json(run, { status: 201 });
});

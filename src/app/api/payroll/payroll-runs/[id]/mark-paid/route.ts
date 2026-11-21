import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import PayrollRun from '@/models/PayrollRun';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const POST = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid payroll run.', 400);
  }

  await connectToDatabase();
  const run = await PayrollRun.findById(id);
  if (!run) {
    throw new ApiError('Payroll run not found.', 404);
  }
  if (run.status !== 'Closed') {
    throw new ApiError('Only a closed payroll run can be marked paid.', 409);
  }

  run.status = 'Paid';
  run.datePaid = new Date();
  await run.save();
  return NextResponse.json(run);
});

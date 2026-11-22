import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Employee from '@/models/Employee';
import PayrollRun from '@/models/PayrollRun';
import PayrollDetail from '@/models/PayrollDetail';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('run');
  if (!runId) {
    throw new ApiError('Payroll run is required.', 400);
  }
  if (!mongoose.isValidObjectId(runId)) {
    throw new ApiError('Invalid payroll run.', 400);
  }
  if (!(await PayrollRun.exists({ _id: runId }))) {
    throw new ApiError('Payroll run not found.', 404);
  }
  const details = await PayrollDetail.find({ run: runId })
    .populate('employee')
    .sort({ 'employee.employeeNo': 1 })
    .lean();
  return NextResponse.json(details);
});

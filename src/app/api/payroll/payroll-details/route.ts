import { NextResponse } from 'next/server';
import Employee from '@/models/Employee';
import PayrollDetail from '@/models/PayrollDetail';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('run');
  if (!runId) {
    return NextResponse.json({ error: 'run param required' }, { status: 400 });
  }
  const details = await PayrollDetail.find({ run: runId })
    .populate('employee')
    .sort({ 'employee.employeeNo': 1 })
    .lean();
  return NextResponse.json(details);
});

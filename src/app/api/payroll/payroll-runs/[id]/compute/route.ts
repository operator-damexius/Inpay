import { NextResponse } from 'next/server';
import PayrollRun from '@/models/PayrollRun';
import PayrollDetail from '@/models/PayrollDetail';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

const RATE_PER_DAY = 397;
const HOURS_PER_DAY = 8;
const OVERTIME_PCT = 1.3;
const SSS_RATE = 0.045;
const AUTO_SSS = true;
const AUTO_13TH = true;

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await connectToDatabase();
  const run = await PayrollRun.findById(id);
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const employees = await Employee.find({ isActive: true }).lean();
  for (const emp of employees) {
    const rate = emp.ratePerDay || RATE_PER_DAY;
    const att = await Attendance.findOne({
      employee: emp._id,
      workDate: { $gte: run.periodStart, $lte: run.periodEnd },
    }).lean();

    const regHours = (att as { totalHours?: number } | null)?.totalHours || 0;
    const otHours = (att as { overtimeHours?: number } | null)?.overtimeHours || 0;
    const days = Math.round((regHours / HOURS_PER_DAY) * 100) / 100;
    const regularPay = days * rate;
    const overtimePay = otHours * rate * OVERTIME_PCT;
    const gross = regularPay + overtimePay;
    const sss = AUTO_SSS ? Math.round(gross * SSS_RATE * 100) / 100 : 0;
    const thirteenth = AUTO_13TH ? Math.round((gross / 12) * 100) / 100 : 0;
    const net = gross - sss - thirteenth;

    await PayrollDetail.findOneAndUpdate(
      { run: run._id, employee: emp._id },
      {
        regularPay,
        overtimePay,
        sssDeduction: sss,
        thirteenth,
        grossPay: gross,
        netPay: net,
      },
      { upsert: true, new: true }
    );
  }

  run.status = 'Closed';
  await run.save();
  return NextResponse.json({ message: 'Payroll computed', run });
});

import { NextResponse } from 'next/server';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import PayrollDetail from '@/models/PayrollDetail';
import PayrollRun from '@/models/PayrollRun';
import AppSettings from '@/models/AppSettings';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';
import { getPayrollWorkDate } from '@/lib/payroll-attendance';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();

  const today = new Date();
  const settings = await AppSettings.findOne({ key: 'global' });
  const startOfToday = getPayrollWorkDate(today, settings?.timezone || 'Asia/Manila');
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

  const [totalEmployees, presentToday, openRuns, latestRunResult, recentAttendance, processedRunsResult] = await Promise.all([
    Employee.countDocuments(),
    Attendance.countDocuments({
      workDate: { $gte: startOfToday, $lt: startOfTomorrow },
      timeIn: { $exists: true },
    }),
    PayrollRun.countDocuments({ status: 'Open' }),
    PayrollRun.findOne({ status: { $in: ['Closed', 'Paid'] } })
      .sort({ periodStart: -1 })
      .lean(),
    Attendance.find()
      .populate('employee', 'employeeNo firstname lastname')
      .sort({ workDate: -1, createdAt: -1 })
      .limit(5)
      .lean(),
    PayrollRun.find({ status: { $in: ['Closed', 'Paid'] } })
      .sort({ periodStart: -1 })
      .limit(6)
      .lean(),
  ]);
  const latestRun = Array.isArray(latestRunResult) ? latestRunResult[0] : latestRunResult;
  const processedRuns = Array.isArray(processedRunsResult)
    ? processedRunsResult
    : processedRunsResult
      ? [processedRunsResult]
      : [];

  let latestRunNetPay: number | null = null;
  const payrollHistory = processedRuns.length
    ? await PayrollDetail.aggregate([
      { $match: { run: { $in: processedRuns.map((run) => run._id) } } },
      { $group: { _id: '$run', netPay: { $sum: '$netPay' } } },
    ])
    : [];
  const totalsByRun = new Map(
    payrollHistory.map((summary) => [String(summary._id), Number(summary.netPay)])
  );
  if (latestRun && payrollHistory.some((summary) => String(summary._id) === String(latestRun._id))) {
    latestRunNetPay = totalsByRun.get(String(latestRun._id)) ?? null;
  }

  return NextResponse.json({
    totalEmployees,
    presentToday,
    openRuns,
    latestRun: latestRun
      ? {
          periodStart: latestRun.periodStart,
          periodEnd: latestRun.periodEnd,
          netPay: latestRunNetPay,
        }
      : null,
    payrollHistory: processedRuns.map((run) => ({
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      status: run.status,
      netPay: totalsByRun.get(String(run._id)) ?? 0,
    })),
    recentAttendance,
  });
});

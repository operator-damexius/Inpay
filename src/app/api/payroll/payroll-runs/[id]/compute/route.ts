import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import PayrollRun from '@/models/PayrollRun';
import PayrollDetail from '@/models/PayrollDetail';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import AppSettings from '@/models/AppSettings';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { calculatePayroll, sumAttendanceRecords } from '@/lib/payroll-calculations';
import { normalizePayrollSettings } from '@/lib/payroll-settings';

export const POST = withErrorHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError('Invalid payroll run.', 400);
  }
  await connectToDatabase();
  const run = await PayrollRun.findById(id);
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }
  if (run.status !== 'Open') {
    throw new ApiError('Only an open payroll run can be computed.', 409);
  }

  const attendanceRecords = await Attendance.find({
    workDate: { $gte: run.periodStart, $lte: run.periodEnd },
  }).lean();
  const employees = await Employee.find({
    $or: [
      { isActive: true },
      { _id: { $in: attendanceRecords.map((record) => record.employee) } },
    ],
  }).lean();
  const employeesById = new Map(employees.map((employee) => [String(employee._id), employee]));
  const missingEmployeeAttendance = attendanceRecords.some(
    (record) => !employeesById.has(String(record.employee))
  );
  if (missingEmployeeAttendance) {
    throw new ApiError(
      'Attendance in this period refers to a missing employee record. Restore the employee before computing payroll.',
      409
    );
  }
  const incompleteAttendance = attendanceRecords.filter((record) => record.timeIn && !record.timeOut);
  if (incompleteAttendance.length > 0) {
    const employeeNames = [...new Set(incompleteAttendance.map((record) => {
      const employee = employeesById.get(String(record.employee));
      return employee ? `${employee.employeeNo} (${employee.firstname} ${employee.lastname})` : 'unknown employee';
    }))];
    throw new ApiError(
      `Clock out before computing payroll for: ${employeeNames.join(', ')}.`,
      409
    );
  }

  const employeesWithAttendance = new Set(
    attendanceRecords.map((record) => String(record.employee))
  );
  const employeesWithoutRate = employees.filter(
    (employee) =>
      employeesWithAttendance.has(String(employee._id)) &&
      (!Number.isFinite(employee.ratePerDay) || employee.ratePerDay <= 0)
  );
  if (employeesWithoutRate.length > 0) {
    throw new ApiError(
      `Set a positive daily rate for: ${employeesWithoutRate.map((employee) => `${employee.employeeNo} (${employee.firstname} ${employee.lastname})`).join(', ')}.`,
      400
    );
  }

  let settings = await AppSettings.findOne({ key: 'global' });
  if (!settings) settings = await AppSettings.create({ key: 'global' });
  const payrollSettings = normalizePayrollSettings(settings);

  const attendanceByEmployee = sumAttendanceRecords(attendanceRecords.map((record) => ({
    employeeId: String(record.employee),
    totalHours: record.totalHours,
    overtimeHours: record.overtimeHours,
    breakHours: record.breakHours ?? 0,
  })));

  await PayrollDetail.deleteMany({
    run: run._id,
    employee: { $nin: employees.map((employee) => employee._id) },
  });

  for (const emp of employees) {
    const attendance = attendanceByEmployee.get(String(emp._id)) ?? {
      totalHours: 0,
      overtimeHours: 0,
      breakHours: 0,
    };
    let calculation: ReturnType<typeof calculatePayroll>;
    try {
      calculation = calculatePayroll({
        totalHours: attendance.totalHours,
        overtimeHours: attendance.overtimeHours,
        ratePerDay: emp.ratePerDay,
        hoursPerDay: payrollSettings.payrollHoursPerDay,
        overtimeEnabled: payrollSettings.payrollOvertimeEnabled,
        overtimeMultiplier: payrollSettings.payrollOvertimeMultiplier,
        sssEnabled: payrollSettings.payrollSssEnabled,
        sssRate: payrollSettings.payrollSssRate,
        thirteenthEnabled: payrollSettings.payrollThirteenthEnabled,
        thirteenthRate: payrollSettings.payrollThirteenthRate,
      });
    } catch (error) {
      if (error instanceof RangeError) {
        throw new ApiError(
          `Could not calculate payroll for ${emp.employeeNo}: ${error.message}`,
          400
        );
      }
      throw error;
    }

    await PayrollDetail.findOneAndUpdate(
      { run: run._id, employee: emp._id },
      {
        regularPay: calculation.regularPay,
        overtimePay: calculation.overtimePay,
        sssDeduction: calculation.sssDeduction,
        thirteenth: calculation.thirteenthAccrual,
        grossPay: calculation.grossPay,
        netPay: calculation.netPay,
        baseHoursPaid: calculation.baseHoursPaid,
        overtimeHours: calculation.overtimeHours,
        breakHours: attendance.breakHours,
        hourlyRate: calculation.hourlyRate,
        overtimeMultiplier: payrollSettings.payrollOvertimeEnabled
          ? payrollSettings.payrollOvertimeMultiplier
          : 0,
        sssRate: payrollSettings.payrollSssEnabled ? payrollSettings.payrollSssRate : 0,
        thirteenthRate: payrollSettings.payrollThirteenthEnabled
          ? payrollSettings.payrollThirteenthRate
          : 0,
      },
      { upsert: true, new: true }
    );
  }

  run.status = 'Closed';
  await run.save();
  return NextResponse.json({ message: 'Payroll computed', run });
});

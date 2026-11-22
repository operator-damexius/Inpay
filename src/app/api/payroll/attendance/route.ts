import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import AppSettings from '@/models/AppSettings';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { calculateAttendanceHours, getPayrollWorkDate } from '@/lib/payroll-attendance';
import { normalizePayrollSettings } from '@/lib/payroll-settings';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const settings = await AppSettings.findOne({ key: 'global' });
  const workDate = getPayrollWorkDate(new Date(), settings?.timezone || 'Asia/Manila');
  const records = await Attendance.find({
    $or: [
      { workDate },
      {
        timeIn: { $exists: true },
        $or: [{ timeOut: { $exists: false } }, { timeOut: null }],
      },
    ],
  })
    .populate('employee')
    .sort({ workDate: -1, createdAt: -1 })
    .limit(100)
    .lean();
  return NextResponse.json(records);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  if (!body || typeof body !== 'object') {
    throw new ApiError('Attendance request is invalid.', 400);
  }
  if (!mongoose.isValidObjectId(body.employeeId)) {
    throw new ApiError('Choose a valid employee.', 400);
  }
  if (body.type !== 'time_in' && body.type !== 'time_out') {
    throw new ApiError('Choose either time in or time out.', 400);
  }

  const employee = await Employee.findById(body.employeeId);
  if (!employee) {
    throw new ApiError('Employee not found.', 404);
  }

  const now = new Date();
  const appSettings = await AppSettings.findOne({ key: 'global' });
  const settings = appSettings ? normalizePayrollSettings(appSettings) : normalizePayrollSettings({});
  const workDate = getPayrollWorkDate(now, appSettings?.timezone || 'Asia/Manila');

  if (body.type === 'time_in') {
    if (!employee.isActive) {
      throw new ApiError('Inactive employees cannot clock in.', 409);
    }
    const openRecord = await Attendance.findOne({
      employee: employee._id,
      timeIn: { $exists: true },
      $or: [{ timeOut: { $exists: false } }, { timeOut: null }],
    }).sort({ timeIn: -1 });
    if (openRecord) {
      throw new ApiError('This employee already has an open shift. Clock out before starting another.', 409);
    }

    let record = await Attendance.findOne({ employee: employee._id, workDate });
    if (record && record.timeIn) {
      throw new ApiError('Already timed in on this work date.', 409);
    }
    if (!record) {
      record = await Attendance.create({
        employee: employee._id,
        workDate,
        timeIn: now,
        shift: employee.shift,
      });
    } else {
      record.timeIn = now;
      await record.save();
    }
    return NextResponse.json({ message: 'Time-in recorded', record });
  }

  const record = await Attendance.findOne({
    employee: employee._id,
    timeIn: { $exists: true },
    $or: [{ timeOut: { $exists: false } }, { timeOut: null }],
  }).sort({ timeIn: -1 });
  if (!record?.timeIn) {
    throw new ApiError('No open shift was found for this employee.', 409);
  }

  let hours: ReturnType<typeof calculateAttendanceHours>;
  try {
    hours = calculateAttendanceHours(
      record.timeIn,
      now,
      settings.payrollHoursPerDay,
      settings.payrollUnpaidBreakHours
    );
  } catch (error) {
    if (error instanceof RangeError) {
      throw new ApiError(error.message, 400);
    }
    throw error;
  }
  record.timeOut = now;
  record.totalHours = hours.totalHours;
  record.overtimeHours = hours.overtimeHours;
  record.breakHours = hours.breakHours;
  await record.save();
  return NextResponse.json({ message: 'Time-out recorded', record });
});

import { NextResponse } from 'next/server';
import Attendance from '@/models/Attendance';
import Employee from '@/models/Employee';
import { connectToDatabase } from '@/lib/mongoose';
import { withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async () => {
  await connectToDatabase();
  const records = await Attendance.find()
    .populate('employee')
    .sort({ workDate: -1, createdAt: -1 })
    .limit(100)
    .lean();
  return NextResponse.json(records);
});

export const POST = withErrorHandler(async (req: Request) => {
  await connectToDatabase();
  const body = await req.json();
  const employee = await Employee.findById(body.employeeId);
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const workDate = new Date(dateStr);

  let record = await Attendance.findOne({ employee: body.employeeId, workDate });

  if (body.type === 'time_in') {
    if (record && record.timeIn) {
      return NextResponse.json({ error: 'Already timed in today' }, { status: 400 });
    }
    if (!record) {
      record = await Attendance.create({
        employee: body.employeeId,
        workDate,
        timeIn: now,
        shift: employee.shift,
      });
    } else {
      record.timeIn = now;
      await record.save();
    }
    return NextResponse.json({ message: 'Time-in recorded', record });
  } else {
    if (!record || !record.timeIn) {
      return NextResponse.json({ error: 'No time-in record for today' }, { status: 400 });
    }
    if (record.timeOut) {
      return NextResponse.json({ error: 'Already timed out today' }, { status: 400 });
    }
    const diffMs = now.getTime() - record.timeIn.getTime();
    const hours = Math.max(0, diffMs) / 3600000;
    const ot = Math.max(0, hours - 8);
    record.timeOut = now;
    record.totalHours = Math.round(hours * 100) / 100;
    record.overtimeHours = Math.round(ot * 100) / 100;
    await record.save();
    return NextResponse.json({ message: 'Time-out recorded', record });
  }
});

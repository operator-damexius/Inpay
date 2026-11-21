import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  employee: mongoose.Types.ObjectId;
  workDate: Date;
  timeIn?: Date;
  timeOut?: Date;
  totalHours: number;
  overtimeHours: number;
  shift?: string;
  createdAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>({
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  workDate: { type: Date, required: true },
  timeIn: { type: Date },
  timeOut: { type: Date },
  totalHours: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  shift: { type: String },
  createdAt: { type: Date, default: Date.now },
});

AttendanceSchema.index({ employee: 1, workDate: 1 }, { unique: true });
AttendanceSchema.index({ workDate: 1 });

export default mongoose.models.Attendance ||
  mongoose.model<IAttendance>('Attendance', AttendanceSchema);

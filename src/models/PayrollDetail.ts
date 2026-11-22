import mongoose, { Schema, Document } from 'mongoose';

export interface IPayrollDetail extends Document {
  run: mongoose.Types.ObjectId;
  employee: mongoose.Types.ObjectId;
  regularPay: number;
  overtimePay: number;
  sssDeduction: number;
  thirteenth: number;
  grossPay: number;
  netPay: number;
  baseHoursPaid?: number;
  overtimeHours?: number;
  breakHours?: number;
  hourlyRate?: number;
  overtimeMultiplier?: number;
  sssRate?: number;
  thirteenthRate?: number;
  notes?: string;
}

const PayrollDetailSchema = new Schema<IPayrollDetail>({
  run: { type: Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  regularPay: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  sssDeduction: { type: Number, default: 0 },
  thirteenth: { type: Number, default: 0 },
  grossPay: { type: Number, default: 0 },
  netPay: { type: Number, default: 0 },
  baseHoursPaid: { type: Number },
  overtimeHours: { type: Number },
  breakHours: { type: Number },
  hourlyRate: { type: Number },
  overtimeMultiplier: { type: Number },
  sssRate: { type: Number },
  thirteenthRate: { type: Number },
  notes: { type: String },
});

PayrollDetailSchema.index({ run: 1, employee: 1 }, { unique: true });

const existingPayrollDetailModel = mongoose.models.PayrollDetail;
if (existingPayrollDetailModel && !existingPayrollDetailModel.schema.path('breakHours')) {
  delete mongoose.models.PayrollDetail;
}

export default mongoose.models.PayrollDetail ||
  mongoose.model<IPayrollDetail>('PayrollDetail', PayrollDetailSchema);

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
  notes: { type: String },
});

PayrollDetailSchema.index({ run: 1, employee: 1 }, { unique: true });

export default mongoose.models.PayrollDetail ||
  mongoose.model<IPayrollDetail>('PayrollDetail', PayrollDetailSchema);

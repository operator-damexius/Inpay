import mongoose, { Schema, Document } from 'mongoose';

export interface IPayrollRun extends Document {
  periodStart: Date;
  periodEnd: Date;
  datePaid?: Date;
  status: 'Open' | 'Closed' | 'Paid';
  createdAt: Date;
}

const PayrollRunSchema = new Schema<IPayrollRun>({
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  datePaid: { type: Date },
  status: { type: String, enum: ['Open', 'Closed', 'Paid'], default: 'Open' },
  createdAt: { type: Date, default: Date.now },
});

PayrollRunSchema.index({ periodStart: -1 });

export default mongoose.models.PayrollRun ||
  mongoose.model<IPayrollRun>('PayrollRun', PayrollRunSchema);

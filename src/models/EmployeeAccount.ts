import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeAccount extends Document {
  employee: mongoose.Types.ObjectId;
  employeeNo: string;
  firstname: string;
  lastname: string;
  balance: number; // positive = owed to employee, negative = employee owes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeAccountSchema = new Schema<IEmployeeAccount>({
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeNo: { type: String, required: true },
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  balance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

EmployeeAccountSchema.index({ employee: 1 }, { unique: true });
EmployeeAccountSchema.index({ employeeNo: 1 });

export default mongoose.models.EmployeeAccount ||
  mongoose.model<IEmployeeAccount>('EmployeeAccount', EmployeeAccountSchema);

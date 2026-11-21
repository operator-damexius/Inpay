import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  employeeNo: string;
  firstname: string;
  lastname: string;
  shift: string;
  ratePerDay: number;
  dateHired?: Date;
  isActive: boolean;
  createdAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>({
  employeeNo: { type: String, required: true, unique: true, trim: true },
  firstname: { type: String, required: true, trim: true },
  lastname: { type: String, required: true, trim: true },
  shift: { type: String, required: true, default: '1st' },
  ratePerDay: { type: Number, required: true, default: 0 },
  dateHired: { type: Date },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Employee ||
  mongoose.model<IEmployee>('Employee', EmployeeSchema);

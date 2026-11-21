import mongoose, { Schema, Document } from 'mongoose';

export interface IUnit extends Document {
  name: string;
  code: string;
}

const UnitSchema = new Schema<IUnit>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
});

export default mongoose.models.Unit || mongoose.model<IUnit>('Unit', UnitSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemAccount extends Document {
  key: 'admin';
  username: string;
  passwordSalt: string;
  passwordHash: string;
  sessionVersion: string;
  updatedAt: Date;
}

const SystemAccountSchema = new Schema<ISystemAccount>(
  {
    key: { type: String, enum: ['admin'], unique: true, required: true, default: 'admin' },
    username: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    passwordSalt: { type: String, required: true },
    passwordHash: { type: String, required: true },
    sessionVersion: { type: String, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

SystemAccountSchema.index({ username: 1 }, { unique: true });

export default mongoose.models.SystemAccount ||
  mongoose.model<ISystemAccount>('SystemAccount', SystemAccountSchema);

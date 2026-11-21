import mongoose, { Schema, Document } from 'mongoose';

export interface ICashierCredential extends Document {
  employee: mongoose.Types.ObjectId;
  pinSalt: string;
  pinHash: string;
  sessionVersion: string;
  failedAttempts: number;
  lockedUntil?: Date;
  updatedAt: Date;
}

const CashierCredentialSchema = new Schema<ICashierCredential>(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
    pinSalt: { type: String, required: true },
    pinHash: { type: String, required: true },
    sessionVersion: { type: String, required: true },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export default mongoose.models.CashierCredential ||
  mongoose.model<ICashierCredential>('CashierCredential', CashierCredentialSchema);

import mongoose, { Schema, Document } from 'mongoose';

export type LedgerAccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface ILedgerAccount extends Document {
  code: string;
  name: string;
  type: LedgerAccountType;
  isActive: boolean;
  createdAt: Date;
}

const LedgerAccountSchema = new Schema<ILedgerAccount>({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['asset', 'liability', 'equity', 'income', 'expense'],
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const existingLedgerAccountModel = mongoose.models.LedgerAccount;
if (existingLedgerAccountModel && !existingLedgerAccountModel.schema.path('isActive')) {
  delete mongoose.models.LedgerAccount;
}

export default mongoose.models.LedgerAccount ||
  mongoose.model<ILedgerAccount>('LedgerAccount', LedgerAccountSchema);

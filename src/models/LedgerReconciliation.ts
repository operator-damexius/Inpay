import mongoose, { Schema, Document } from 'mongoose';

export interface ILedgerReconciliation extends Document {
  account: mongoose.Types.ObjectId;
  journalEntry?: mongoose.Types.ObjectId;
  statementDate: Date;
  actualBalance: number;
  bookBalance: number;
  difference: number;
  reference: string;
  referenceKey: string;
  reason: string;
  createdBy: string;
  createdAt: Date;
}

const LedgerReconciliationSchema = new Schema<ILedgerReconciliation>({
  account: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
  journalEntry: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
  statementDate: { type: Date, required: true },
  actualBalance: { type: Number, required: true },
  bookBalance: { type: Number, required: true },
  difference: { type: Number, required: true },
  reference: { type: String, required: true, trim: true },
  referenceKey: { type: String, required: true, trim: true, lowercase: true },
  reason: { type: String, required: true, trim: true },
  createdBy: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

LedgerReconciliationSchema.index({ account: 1, referenceKey: 1 }, { unique: true });
LedgerReconciliationSchema.index({ account: 1, statementDate: -1 });

export default mongoose.models.LedgerReconciliation ||
  mongoose.model<ILedgerReconciliation>('LedgerReconciliation', LedgerReconciliationSchema);

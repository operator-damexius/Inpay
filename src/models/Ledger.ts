import mongoose, { Schema, Document } from 'mongoose';
import { PNL_CATEGORIES, type PnlCategory } from '@/lib/pnl-categories';

export interface ILedger extends Document {
  type: 'item' | 'payment' | 'adjustment' | 'transfer' | 'purchase';
  pnlCategory: PnlCategory;
  reference: string; // SKU, invoice no, transfer no, etc.
  description: string;
  amount: number; // positive = income/in, negative = expense/out
  balance: number; // running balance after this entry
  date: Date;
  createdBy?: string;
  reversalOf?: mongoose.Types.ObjectId;
  migratedToJournal: boolean;
  auditLog: Array<{
    action: string;
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedAt: Date;
  }>;
  createdAt: Date;
}

const LedgerSchema = new Schema<ILedger>({
  type: { type: String, enum: ['item', 'payment', 'adjustment', 'transfer', 'purchase'], required: true },
  pnlCategory: {
    type: String,
    enum: [...PNL_CATEGORIES.map((category) => category.value), 'unclassified'],
    default: 'unclassified',
  },
  reference: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, default: 0 },
  balance: { type: Number, required: true, default: 0 },
  date: { type: Date, required: true, default: Date.now },
  createdBy: { type: String },
  reversalOf: { type: Schema.Types.ObjectId, ref: 'Ledger' },
  migratedToJournal: { type: Boolean, default: false },
  auditLog: {
    type: [{
      action: { type: String, required: true },
      oldValue: { type: String, required: true },
      newValue: { type: String, required: true },
      changedBy: { type: String, required: true },
      changedAt: { type: Date, required: true, default: Date.now },
    }],
    default: [],
  },
  createdAt: { type: Date, default: Date.now },
});

LedgerSchema.index({ date: -1 });
LedgerSchema.index({ type: 1 });
LedgerSchema.index({ reversalOf: 1 }, { unique: true, sparse: true });

const existingLedgerModel = mongoose.models.Ledger;
if (existingLedgerModel && !existingLedgerModel.schema.path('migratedToJournal')) {
  delete mongoose.models.Ledger;
}

export default mongoose.models.Ledger || mongoose.model<ILedger>('Ledger', LedgerSchema);

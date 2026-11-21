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
  createdAt: { type: Date, default: Date.now },
});

LedgerSchema.index({ date: -1 });
LedgerSchema.index({ type: 1 });

export default mongoose.models.Ledger || mongoose.model<ILedger>('Ledger', LedgerSchema);

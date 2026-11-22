import mongoose, { Schema, Document } from 'mongoose';
import { PNL_CATEGORIES, type PnlCategory } from '@/lib/pnl-categories';

export interface IJournalLine {
  account: mongoose.Types.ObjectId;
  debit: number;
  credit: number;
  pnlCategory?: PnlCategory;
  memo?: string;
}

export interface IJournalEntry extends Document {
  sourceKey: string;
  sourceType?: string;
  reference: string;
  description: string;
  date: Date;
  lines: IJournalLine[];
  createdBy: string;
  reversalOf?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const JournalLineSchema = new Schema<IJournalLine>(
  {
    account: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
    debit: { type: Number, required: true, min: 0, default: 0 },
    credit: { type: Number, required: true, min: 0, default: 0 },
    pnlCategory: {
      type: String,
      enum: [...PNL_CATEGORIES.map((category) => category.value), 'unclassified'],
    },
    memo: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const JournalEntrySchema = new Schema<IJournalEntry>({
  sourceKey: { type: String, required: true, unique: true, trim: true },
  sourceType: { type: String, trim: true, default: 'manual' },
  reference: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  lines: {
    type: [JournalLineSchema],
    required: true,
    validate: {
      validator(lines: IJournalLine[]) {
        return lines.length >= 2;
      },
      message: 'A journal entry must contain at least two lines.',
    },
  },
  createdBy: { type: String, required: true, trim: true },
  reversalOf: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
  createdAt: { type: Date, default: Date.now },
});

JournalEntrySchema.index({ date: -1, createdAt: -1 });
JournalEntrySchema.index({ reference: 1 });
JournalEntrySchema.index({ reversalOf: 1 }, { unique: true, sparse: true });

const existingJournalEntryModel = mongoose.models.JournalEntry;
if (
  existingJournalEntryModel &&
  (!existingJournalEntryModel.schema.path('sourceType') || !existingJournalEntryModel.schema.path('reversalOf'))
) {
  delete mongoose.models.JournalEntry;
}

export default mongoose.models.JournalEntry ||
  mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema);

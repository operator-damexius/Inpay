import mongoose, { Schema, Document } from 'mongoose';

export interface IStockAdjustment extends Document {
  item: mongoose.Types.ObjectId;
  location?: mongoose.Types.ObjectId;
  type: 'Add' | 'Subtract' | 'Set';
  qty: number;
  reason?: string;
  refNo?: string;
  createdBy?: string;
  createdAt: Date;
}

const StockAdjustmentSchema = new Schema<IStockAdjustment>({
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  location: { type: Schema.Types.ObjectId, ref: 'Location' },
  type: { type: String, enum: ['Add', 'Subtract', 'Set'], default: 'Add' },
  qty: { type: Number, default: 0 },
  reason: { type: String },
  refNo: { type: String },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
});

StockAdjustmentSchema.index({ item: 1 });
StockAdjustmentSchema.index({ createdAt: -1 });

export default mongoose.models.StockAdjustment ||
  mongoose.model<IStockAdjustment>('StockAdjustment', StockAdjustmentSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IStockBalance extends Document {
  item: mongoose.Types.ObjectId;
  location: mongoose.Types.ObjectId;
  quantity: number;
  cogsEligibleQuantity: number;
  updatedAt: Date;
}

const StockBalanceSchema = new Schema<IStockBalance>({
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  cogsEligibleQuantity: { type: Number, required: true, min: 0, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

StockBalanceSchema.index({ item: 1, location: 1 }, { unique: true });

export default mongoose.models.StockBalance ||
  mongoose.model<IStockBalance>('StockBalance', StockBalanceSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IStockTransfer extends Document {
  item: mongoose.Types.ObjectId;
  fromLocation: mongoose.Types.ObjectId;
  toLocation: mongoose.Types.ObjectId;
  qty: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  refNo?: string;
  createdAt: Date;
  completedAt?: Date;
}

const StockTransferSchema = new Schema<IStockTransfer>({
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  fromLocation: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  toLocation: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  qty: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Cancelled'],
    default: 'Pending',
  },
  refNo: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

StockTransferSchema.index({ status: 1 });
StockTransferSchema.index({ createdAt: -1 });
StockTransferSchema.index({ status: 1, completedAt: -1 });

export default mongoose.models.StockTransfer ||
  mongoose.model<IStockTransfer>('StockTransfer', StockTransferSchema);

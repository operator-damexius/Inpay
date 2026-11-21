import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchase extends Document {
  item: mongoose.Types.ObjectId;
  location: mongoose.Types.ObjectId;
  supplier?: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: Date;
  status: 'Ordered' | 'Received' | 'Cancelled';
  reference?: string;
  receivedAt?: Date;
  createdAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>({
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  supplier: { type: String },
  qty: { type: Number, default: 0 },
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  purchaseDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['Ordered', 'Received', 'Cancelled'],
    default: 'Ordered',
  },
  reference: { type: String },
  receivedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

PurchaseSchema.index({ item: 1 });
PurchaseSchema.index({ purchaseDate: -1 });
PurchaseSchema.index({ status: 1, receivedAt: -1, createdAt: -1 });

export default mongoose.models.Purchase || mongoose.model<IPurchase>('Purchase', PurchaseSchema);

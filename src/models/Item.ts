import mongoose, { Schema, Document } from 'mongoose';

export interface IItem extends Document {
  sku: string;
  name: string;
  category?: mongoose.Types.ObjectId;
  unit?: mongoose.Types.ObjectId;
  location?: mongoose.Types.ObjectId;
  price: number;
  sellingPrice: number;
  reorderLevel: number;
  stockOnHand: number;
  icon?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
}

const ItemSchema = new Schema<IItem>({
  sku: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  unit: { type: Schema.Types.ObjectId, ref: 'Unit' },
  location: { type: Schema.Types.ObjectId, ref: 'Location' },
  price: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0, min: 0 },
  reorderLevel: { type: Number, default: 0 },
  stockOnHand: { type: Number, default: 0 },
  icon: { type: String },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

ItemSchema.index({ sku: 1 }, { unique: true });

export default mongoose.models.Item || mongoose.model<IItem>('Item', ItemSchema);

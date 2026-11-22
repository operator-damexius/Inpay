import mongoose, { Schema, Document } from 'mongoose';

export interface ISaleLine {
  item: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ISale extends Document {
  receiptNo: string;
  idempotencyKey?: string;
  cashier: mongoose.Types.ObjectId;
  cashierName: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  location: mongoose.Types.ObjectId;
  customer: string;
  paymentMethod: string;
  items: ISaleLine[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
}

const SaleLineSchema = new Schema<ISaleLine>(
  {
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    unit: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISale>({
  receiptNo: { type: String, required: true, unique: true, trim: true },
  idempotencyKey: { type: String, trim: true },
  cashier: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  cashierName: { type: String, required: true },
  businessName: { type: String, required: true, default: 'Inpay' },
  businessAddress: { type: String, default: '' },
  businessPhone: { type: String, default: '' },
  location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
  customer: { type: String, required: true, trim: true, default: 'Walk-in' },
  paymentMethod: { type: String, required: true },
  items: { type: [SaleLineSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now },
});

SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ cashier: 1, createdAt: -1 });
SaleSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const existingSaleModel = mongoose.models.Sale;
if (existingSaleModel && !existingSaleModel.schema.path('idempotencyKey')) {
  delete mongoose.models.Sale;
}

export default mongoose.models.Sale || mongoose.model<ISale>('Sale', SaleSchema);

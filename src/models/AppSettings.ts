import mongoose, { Schema, Document } from 'mongoose';

export const POS_PAYMENT_METHODS = ['cash', 'gcash', 'bank_transfer', 'card'] as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export interface IAppSettings extends Document {
  key: 'global';
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  currency: 'PHP';
  timezone: string;
  posPaymentMethods: PosPaymentMethod[];
  posQuantityPrecision: number;
  taxEnabled: boolean;
  taxRate: number;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    key: { type: String, enum: ['global'], unique: true, default: 'global' },
    businessName: { type: String, trim: true, default: 'Inpay' },
    businessAddress: { type: String, trim: true, default: '' },
    businessPhone: { type: String, trim: true, default: '' },
    businessEmail: { type: String, trim: true, default: '' },
    fiscalYearStartMonth: { type: Number, min: 1, max: 12, default: 1 },
    fiscalYearStartDay: { type: Number, min: 1, max: 31, default: 1 },
    currency: { type: String, enum: ['PHP'], default: 'PHP' },
    timezone: { type: String, default: 'Asia/Manila' },
    posPaymentMethods: {
      type: [{ type: String, enum: POS_PAYMENT_METHODS }],
      default: ['cash', 'gcash', 'bank_transfer', 'card'],
    },
    posQuantityPrecision: { type: Number, min: 0, max: 4, default: 2 },
    taxEnabled: { type: Boolean, default: false },
    taxRate: { type: Number, min: 0, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export default mongoose.models.AppSettings ||
  mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

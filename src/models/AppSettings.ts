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
  payrollOvertimeEnabled: boolean;
  payrollOvertimeMultiplier: number;
  payrollHoursPerDay: number;
  payrollUnpaidBreakHours: number;
  payrollSssEnabled: boolean;
  payrollSssRate: number;
  payrollThirteenthEnabled: boolean;
  payrollThirteenthRate: number;
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
    payrollOvertimeEnabled: { type: Boolean, default: true },
    payrollOvertimeMultiplier: { type: Number, min: 1, max: 10, default: 1.3 },
    payrollHoursPerDay: { type: Number, min: 0.1, max: 24, default: 8 },
    payrollUnpaidBreakHours: { type: Number, min: 0, max: 4, default: 1 },
    payrollSssEnabled: { type: Boolean, default: true },
    payrollSssRate: { type: Number, min: 0, max: 1, default: 0.045 },
    payrollThirteenthEnabled: { type: Boolean, default: true },
    payrollThirteenthRate: { type: Number, min: 0, max: 1, default: 1 / 12 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const existingAppSettingsModel = mongoose.models.AppSettings;
const payrollSettingPaths = [
  'payrollOvertimeEnabled',
  'payrollOvertimeMultiplier',
  'payrollHoursPerDay',
  'payrollUnpaidBreakHours',
  'payrollSssEnabled',
  'payrollSssRate',
  'payrollThirteenthEnabled',
  'payrollThirteenthRate',
];
if (
  existingAppSettingsModel &&
  payrollSettingPaths.some((path) => !existingAppSettingsModel.schema.path(path))
) {
  delete mongoose.models.AppSettings;
}

export default mongoose.models.AppSettings ||
  mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

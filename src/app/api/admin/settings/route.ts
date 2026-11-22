import { NextResponse } from 'next/server';
import AppSettings, { POS_PAYMENT_METHODS } from '@/models/AppSettings';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';
import { normalizePayrollSettings, type PayrollSettings } from '@/lib/payroll-settings';

async function getSettings() {
  let settings = await AppSettings.findOne({ key: 'global' });
  if (!settings) settings = await AppSettings.create({ key: 'global' });
  const payrollSettings = normalizePayrollSettings(settings);
  let changed = false;
  for (const key of Object.keys(payrollSettings) as Array<keyof PayrollSettings>) {
    if (!settings.schema.path(key)) {
      throw new ApiError('Payroll settings schema is outdated. Restart the application and try again.', 503);
    }
    if (settings.get(key) !== payrollSettings[key]) {
      settings.set(key, payrollSettings[key]);
      changed = true;
    }
  }
  if (changed) await settings.save();
  return settings;
}

export const GET = withErrorHandler(async (request: Request) => {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  await connectToDatabase();
  return NextResponse.json(await getSettings());
});

export const PUT = withErrorHandler(async (request: Request) => {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const body = await request.json();
  const month = Number(body.fiscalYearStartMonth);
  const day = Number(body.fiscalYearStartDay);
  const precision = Number(body.posQuantityPrecision);
  const validDate = new Date(Date.UTC(2000, month - 1, day));
  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    validDate.getUTCMonth() !== month - 1 ||
    validDate.getUTCDate() !== day
  ) {
    throw new ApiError('Choose a valid fiscal year start month and day.', 400);
  }
  if (!Number.isInteger(precision) || precision < 0 || precision > 4) {
    throw new ApiError('Quantity precision must be between 0 and 4 decimal places.', 400);
  }
  const taxRate = Number(body.taxRate ?? 0);
  if (typeof body.taxEnabled !== 'boolean' || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    throw new ApiError('Tax rate must be between 0% and 100%.', 400);
  }
  if (
    !Array.isArray(body.posPaymentMethods) ||
    body.posPaymentMethods.length === 0 ||
    body.posPaymentMethods.some(
      (method: unknown) =>
        typeof method !== 'string' ||
        !POS_PAYMENT_METHODS.some((allowed) => allowed === method)
    )
  ) {
    throw new ApiError('Choose at least one supported POS payment method.', 400);
  }

  const payrollNumberFields = [
    ['payrollOvertimeMultiplier', 1, 10, 'Overtime multiplier'],
    ['payrollHoursPerDay', 0.1, 24, 'Hours per day'],
    ['payrollUnpaidBreakHours', 0, 4, 'Unpaid break duration'],
    ['payrollSssRate', 0, 1, 'SSS percentage'],
    ['payrollThirteenthRate', 0, 1, '13th-month accrual percentage'],
  ] as const;
  for (const [field, minimum, maximum, label] of payrollNumberFields) {
    const value = Number(body[field]);
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new ApiError(`${label} must be between ${minimum} and ${maximum}.`, 400);
    }
  }
  const payrollBooleanFields = [
    'payrollOvertimeEnabled',
    'payrollSssEnabled',
    'payrollThirteenthEnabled',
  ] as const;
  for (const field of payrollBooleanFields) {
    if (typeof body[field] !== 'boolean') {
      throw new ApiError(`Choose whether ${field.replace('payroll', '').replace('Enabled', '').toLowerCase()} is enabled.`, 400);
    }
  }

  const fields = ['businessName', 'businessAddress', 'businessPhone', 'businessEmail'] as const;
  for (const field of fields) {
    if (typeof body[field] !== 'string' || body[field].length > 250) {
      throw new ApiError(`Enter a valid ${field.replace('business', 'business ')}.`, 400);
    }
  }
  if (body.businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.businessEmail)) {
    throw new ApiError('Enter a valid business email address.', 400);
  }

  await connectToDatabase();
  const settings = await getSettings();
  settings.businessName = body.businessName.trim();
  settings.businessAddress = body.businessAddress.trim();
  settings.businessPhone = body.businessPhone.trim();
  settings.businessEmail = body.businessEmail.trim();
  settings.fiscalYearStartMonth = month;
  settings.fiscalYearStartDay = day;
  settings.posPaymentMethods = body.posPaymentMethods;
  settings.posQuantityPrecision = precision;
  settings.taxEnabled = body.taxEnabled;
  settings.taxRate = taxRate;
  settings.payrollOvertimeEnabled = body.payrollOvertimeEnabled;
  settings.payrollOvertimeMultiplier = Number(body.payrollOvertimeMultiplier);
  settings.payrollHoursPerDay = Number(body.payrollHoursPerDay);
  settings.payrollUnpaidBreakHours = Number(body.payrollUnpaidBreakHours);
  settings.payrollSssEnabled = body.payrollSssEnabled;
  settings.payrollSssRate = Number(body.payrollSssRate);
  settings.payrollThirteenthEnabled = body.payrollThirteenthEnabled;
  settings.payrollThirteenthRate = Number(body.payrollThirteenthRate);
  await settings.save();
  return NextResponse.json(settings);
});

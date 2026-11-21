import { NextResponse } from 'next/server';
import AppSettings, { POS_PAYMENT_METHODS } from '@/models/AppSettings';
import { connectToDatabase } from '@/lib/mongoose';
import { ApiError, withErrorHandler } from '@/lib/api-handler';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';

async function getSettings() {
  let settings = await AppSettings.findOne({ key: 'global' });
  if (!settings) settings = await AppSettings.create({ key: 'global' });
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
  await settings.save();
  return NextResponse.json(settings);
});

import { NextResponse } from 'next/server';
import SystemAccount from '@/models/SystemAccount';
import { connectToDatabase } from '@/lib/mongoose';
import {
  getAdminUsername,
  isAdminAuthConfigured,
  isAdminBootstrapConfigured,
} from '@/lib/admin-auth';

export async function GET(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({
      configured: false,
      databaseReady: false,
      authenticated: false,
      username: null,
    });
  }
  try {
    await connectToDatabase();
  } catch {
    return NextResponse.json({
      configured: false,
      databaseReady: false,
      authenticated: false,
      username: null,
      error: 'Cannot reach MongoDB. Configure MONGODB_URI and verify the database is available.',
    }, { status: 503 });
  }
  const accountExists = await SystemAccount.exists({ key: 'admin' });
  const configured = Boolean(accountExists) || isAdminBootstrapConfigured();
  const username = configured ? await getAdminUsername(request) : null;
  return NextResponse.json({
    configured,
    databaseReady: true,
    authenticated: Boolean(username),
    username,
  });
}

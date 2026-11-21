import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { resetBusinessData, storeRecoveryBackup } from '@/lib/admin-database';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';

export async function POST(request: Request) {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (body?.confirmation !== 'RESET ALL BUSINESS DATA') {
    return NextResponse.json({ error: 'Type RESET ALL BUSINESS DATA to confirm.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const recoveryBackup = await storeRecoveryBackup('before-reset');
    await resetBusinessData();
    return NextResponse.json({
      reset: true,
      preservedSettings: true,
      recoveryBackup,
    });
  } catch (error) {
    console.error('Database reset failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database reset failed.' },
      { status: 500 }
    );
  }
}

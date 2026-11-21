import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { listRecoveryBackups } from '@/lib/admin-database';
import { getAdminUsername } from '@/lib/admin-auth';

export async function GET(request: Request) {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  try {
    await connectToDatabase();
    return NextResponse.json(await listRecoveryBackups());
  } catch (error) {
    console.error('Could not list database backups:', error);
    return NextResponse.json({ error: 'Could not list database backups.' }, { status: 500 });
  }
}

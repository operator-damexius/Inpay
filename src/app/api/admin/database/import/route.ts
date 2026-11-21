import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { parseBackup, replaceDatabaseData, storeRecoveryBackup, MAX_BACKUP_BYTES } from '@/lib/admin-database';
import { getAdminUsername, isSameOriginRequest } from '@/lib/admin-auth';

export async function POST(request: Request) {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const backupFile = formData.get('backup');
    if (!(backupFile instanceof File)) {
      return NextResponse.json({ error: 'Choose a JSON backup file.' }, { status: 400 });
    }
    if (backupFile.size > MAX_BACKUP_BYTES) {
      return NextResponse.json({ error: 'Backup exceeds the 50 MB limit.' }, { status: 413 });
    }
    if (formData.get('confirmation') !== 'REPLACE APPLICATION DATA') {
      return NextResponse.json({ error: 'Type REPLACE APPLICATION DATA to confirm restore.' }, { status: 400 });
    }

    const archive = parseBackup(Buffer.from(await backupFile.arrayBuffer()));
    await connectToDatabase();
    const recoveryBackup = await storeRecoveryBackup('before-restore');
    await replaceDatabaseData(archive);
    return NextResponse.json({ restored: true, recoveryBackup });
  } catch (error) {
    console.error('Database restore failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database restore failed.' },
      { status: 400 }
    );
  }
}

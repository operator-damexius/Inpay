import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { downloadRecoveryBackup, isValidBackupId } from '@/lib/admin-database';
import { getAdminUsername } from '@/lib/admin-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidBackupId(id)) {
    return NextResponse.json({ error: 'Invalid backup ID.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const backup = await downloadRecoveryBackup(id);
    return new NextResponse(new Uint8Array(backup), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="inpay-recovery-backup.json"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Database backup download failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database backup download failed.' },
      { status: 404 }
    );
  }
}

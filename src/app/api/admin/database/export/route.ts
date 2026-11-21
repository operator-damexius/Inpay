import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { exportDatabaseBackup } from '@/lib/admin-database';
import { getAdminUsername } from '@/lib/admin-auth';

export async function GET(request: Request) {
  if (!(await getAdminUsername(request))) {
    return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  }
  try {
    await connectToDatabase();
    const backup = await exportDatabaseBackup();
    const filename = `inpay-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    return new NextResponse(new Uint8Array(backup), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Database export failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Database export failed.' },
      { status: 500 }
    );
  }
}

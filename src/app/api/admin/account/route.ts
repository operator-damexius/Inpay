import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import SystemAccount from '@/models/SystemAccount';
import { connectToDatabase } from '@/lib/mongoose';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  getAdminUsername,
  hashAdminPassword,
  isSameOriginRequest,
  verifyAdminPassword,
} from '@/lib/admin-auth';
import { ApiError, withErrorHandler } from '@/lib/api-handler';

export const GET = withErrorHandler(async (request: Request) => {
  const username = await getAdminUsername(request);
  if (!username) return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  return NextResponse.json({ username });
});

export const PUT = withErrorHandler(async (request: Request) => {
  const username = await getAdminUsername(request);
  if (!username) return NextResponse.json({ error: 'Admin login required.' }, { status: 401 });
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const body = await request.json();
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newUsername = typeof body.username === 'string' ? body.username.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!currentPassword || currentPassword.length > 256) {
    throw new ApiError('Enter your current password.', 400);
  }
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(newUsername)) {
    throw new ApiError('Username must be 3–64 characters and use letters, numbers, dots, underscores, or hyphens.', 400);
  }
  if (newPassword.length < 12 || newPassword.length > 256) {
    throw new ApiError('New password must be between 12 and 256 characters.', 400);
  }

  await connectToDatabase();
  const account = await SystemAccount.findOne({ key: 'admin' });
  if (!account || !verifyAdminPassword(currentPassword, account.passwordSalt, account.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
  }

  const { salt, hash } = hashAdminPassword(newPassword);
  account.username = newUsername;
  account.passwordSalt = salt;
  account.passwordHash = hash;
  account.sessionVersion = randomBytes(16).toString('hex');
  await account.save();

  const response = NextResponse.json({ username: account.username });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    createAdminSession(account._id.toString(), account.username, account.sessionVersion),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE,
    }
  );
  return response;
});

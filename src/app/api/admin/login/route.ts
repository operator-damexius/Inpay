import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import SystemAccount from '@/models/SystemAccount';
import { connectToDatabase } from '@/lib/mongoose';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  hashAdminPassword,
  isAdminAuthConfigured,
  isAdminBootstrapConfigured,
  isSameOriginRequest,
  verifyAdminCredentials,
  verifyAdminPassword,
} from '@/lib/admin-auth';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  if (!isAdminAuthConfigured()) {
    return NextResponse.json(
      { error: 'Set a 32-character ADMIN_SESSION_SECRET first.' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.username !== 'string' ||
    typeof body.password !== 'string' ||
    !body.username.trim() ||
    body.username.trim().length > 100 ||
    !body.password ||
    body.password.length > 256
  ) {
    return NextResponse.json({ error: 'Enter a valid username and password.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
  } catch {
    return NextResponse.json(
      { error: 'Cannot reach MongoDB. Configure MONGODB_URI and verify the database is available.' },
      { status: 503 }
    );
  }
  let account = await SystemAccount.findOne({ key: 'admin' });
  if (!account) {
    if (!isAdminBootstrapConfigured()) {
      return NextResponse.json(
        { error: 'No system account exists. Configure ADMIN_USERNAME and ADMIN_PASSWORD for initial setup.' },
        { status: 503 }
      );
    }
    if (!verifyAdminCredentials(body.username, body.password)) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const { salt, hash } = hashAdminPassword(body.password);
    try {
      account = await SystemAccount.findOneAndUpdate(
        { key: 'admin' },
        {
          $setOnInsert: {
            key: 'admin',
            username: body.username.trim(),
            passwordSalt: salt,
            passwordHash: hash,
            sessionVersion: randomBytes(16).toString('hex'),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 11000
      ) {
        throw error;
      }
      account = await SystemAccount.findOne({ key: 'admin' });
    }
  }

  if (
    !account ||
    account.username !== body.username.trim() ||
    !verifyAdminPassword(body.password, account.passwordSalt, account.passwordHash)
  ) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true, username: account.username });
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
}

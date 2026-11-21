import { NextResponse } from 'next/server';
import { POS_SESSION_COOKIE } from '@/lib/pos-auth';
import { isSameOriginRequest } from '@/lib/admin-auth';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(POS_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

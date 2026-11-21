import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'inpay_admin_session';
export const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60;

export type AdminSession = {
  accountId: string;
  username: string;
  sessionVersion: string;
};

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function getAdminBootstrapConfig() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

function constantTimeEqual(left: string, right: string) {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function isAdminAuthConfigured() {
  return getSessionSecret() !== null;
}

export function isAdminBootstrapConfigured() {
  return getAdminBootstrapConfig() !== null;
}

export function verifyAdminCredentials(username: string, password: string) {
  const config = getAdminBootstrapConfig();
  if (!config) return false;
  return constantTimeEqual(username.trim(), config.username) &&
    constantTimeEqual(password, config.password);
}

export function hashAdminPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString('hex'),
  };
}

export function verifyAdminPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = scryptSync(password, salt, 64).toString('hex');
  return constantTimeEqual(actualHash, expectedHash);
}

export function createAdminSession(accountId: string, username: string, sessionVersion: string) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('Admin session secret is not configured.');
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE;
  const payload = Buffer.from(JSON.stringify({
    accountId,
    username,
    sessionVersion,
    expiresAt,
  })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function getAdminSession(request: Request): AdminSession | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const cookie = request.headers.get('cookie') || '';
  const token = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(ADMIN_SESSION_COOKIE.length + 1);
  if (!token) return null;

  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  if (!constantTimeEqual(signature, sign(payload, secret))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      accountId?: unknown;
      username?: unknown;
      sessionVersion?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof session.accountId !== 'string' ||
      typeof session.username !== 'string' ||
      typeof session.sessionVersion !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      accountId: session.accountId,
      username: session.username,
      sessionVersion: session.sessionVersion,
    };
  } catch {
    return null;
  }
}

export async function getAdminUsername(request: Request) {
  const session = getAdminSession(request);
  if (!session) return null;

  const [{ default: SystemAccount }, { connectToDatabase }] = await Promise.all([
    import('@/models/SystemAccount'),
    import('@/lib/mongoose'),
  ]);
  await connectToDatabase();
  const account = await SystemAccount.findOne({
    _id: session.accountId,
    key: 'admin',
    username: session.username,
    sessionVersion: session.sessionVersion,
  }).select('username');
  return account?.username ?? null;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

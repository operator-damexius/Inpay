import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const POS_SESSION_COOKIE = 'inpay_pos_cashier';
export const POS_SESSION_MAX_AGE = 8 * 60 * 60;

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function isPosAuthConfigured() {
  return getSessionSecret() !== null;
}

function constantTimeEqual(left: string, right: string) {
  const leftHash = Buffer.from(left);
  const rightHash = Buffer.from(right);
  return leftHash.length === rightHash.length && timingSafeEqual(leftHash, rightHash);
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function hashCashierPin(pin: string, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(pin, salt, 64).toString('hex'),
  };
}

export function verifyCashierPin(pin: string, salt: string, expectedHash: string) {
  const actualHash = scryptSync(pin, salt, 64).toString('hex');
  return constantTimeEqual(actualHash, expectedHash);
}

export function createPosSession(employeeId: string, sessionVersion: string) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('Admin session secret is not configured.');
  const payload = Buffer.from(JSON.stringify({
    employeeId,
    sessionVersion,
    expiresAt: Math.floor(Date.now() / 1000) + POS_SESSION_MAX_AGE,
  })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function getPosCashierSession(request: Request) {
  const secret = getSessionSecret();
  if (!secret) return null;

  const token = (request.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${POS_SESSION_COOKIE}=`))
    ?.slice(POS_SESSION_COOKIE.length + 1);
  if (!token) return null;

  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  if (!constantTimeEqual(signature, sign(payload, secret))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      employeeId?: unknown;
      sessionVersion?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof session.employeeId !== 'string' ||
      typeof session.sessionVersion !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      employeeId: session.employeeId,
      sessionVersion: session.sessionVersion,
    };
  } catch {
    return null;
  }
}

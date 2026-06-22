import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const OWNER_SESSION_COOKIE = 'cleon_owner_session';

const SESSION_VERSION = 'v1';
const DEFAULT_SESSION_MAX_AGE_DAYS = 90;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type OwnerSessionPayload = {
  sub: 'owner';
  iat: number;
  exp: number;
};

function getSessionSecret() {
  return process.env.CLEON_SESSION_SECRET || '';
}

function getOwnerAccessKey() {
  return process.env.CLEON_OWNER_ACCESS_KEY || '';
}

export function isAuthConfigured() {
  return Boolean(getSessionSecret() && getOwnerAccessKey());
}

export function getSessionMaxAgeSeconds() {
  const parsed = Number.parseInt(process.env.CLEON_SESSION_MAX_AGE_DAYS || '', 10);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_MAX_AGE_DAYS;
  return days * 24 * 60 * 60;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function signPayload(payload: string) {
  const secret = getSessionSecret();
  if (!secret) return '';

  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashValue(value: string) {
  return crypto.createHash('sha256').update(value).digest();
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((cookie) => {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) return;

    const key = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();
    if (key) cookies.set(key, value);
  });

  return cookies;
}

export function verifyOwnerAccessKey(candidate: string) {
  const expected = getOwnerAccessKey();
  if (!expected || !candidate) return false;

  const expectedHash = hashValue(expected);
  const candidateHash = hashValue(candidate);
  return crypto.timingSafeEqual(expectedHash, candidateHash);
}

export function createOwnerSessionValue(nowSeconds = Math.floor(Date.now() / 1000)) {
  const maxAge = getSessionMaxAgeSeconds();
  const payload: OwnerSessionPayload = {
    sub: 'owner',
    iat: nowSeconds,
    exp: nowSeconds + maxAge,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(`${SESSION_VERSION}.${encodedPayload}`);

  return `${SESSION_VERSION}.${encodedPayload}.${signature}`;
}

export function isOwnerSessionValue(sessionValue: string | undefined | null) {
  if (!sessionValue || !getSessionSecret()) return false;

  const [version, encodedPayload, signature] = sessionValue.split('.');
  if (version !== SESSION_VERSION || !encodedPayload || !signature) return false;

  const expectedSignature = signPayload(`${version}.${encodedPayload}`);
  if (!expectedSignature || !constantTimeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OwnerSessionPayload;
    const nowSeconds = Math.floor(Date.now() / 1000);

    return payload.sub === 'owner'
      && Number.isFinite(payload.iat)
      && Number.isFinite(payload.exp)
      && payload.exp > nowSeconds;
  } catch {
    return false;
  }
}

export function isOwnerRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const session = parseCookieHeader(cookieHeader).get(OWNER_SESSION_COOKIE);
  return isOwnerSessionValue(session);
}

export function setOwnerSessionCookie(response: NextResponse) {
  response.cookies.set(OWNER_SESSION_COOKIE, createOwnerSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: getSessionMaxAgeSeconds(),
  });
}

export function clearOwnerSessionCookie(response: NextResponse) {
  response.cookies.set(OWNER_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function isSameOriginMutation(req: Request) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

  const requestOrigin = new URL(req.url).origin;
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');

  if (origin && origin !== requestOrigin) return false;

  if (
    fetchSite
    && fetchSite !== 'same-origin'
    && fetchSite !== 'same-site'
    && fetchSite !== 'none'
  ) {
    return false;
  }

  return true;
}

export function requireOwnerRequest(req: Request) {
  if (!isOwnerRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

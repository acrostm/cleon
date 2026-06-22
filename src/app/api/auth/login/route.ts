import { NextResponse } from 'next/server';

import {
  isAuthConfigured,
  isSameOriginMutation,
  setOwnerSessionCookie,
  verifyOwnerAccessKey,
} from '@/lib/auth/session';
import { assertWindowRateLimit, hashedRateLimitKey } from '@/lib/redis';
import { getClientIp } from '@/lib/request';

export const runtime = 'nodejs';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function recordFailedLogin(req: Request) {
  await assertWindowRateLimit(
    hashedRateLimitKey('owner-login', [getClientIp(req)]),
    8,
    15 * 60,
    'Too many failed login attempts. Try again later.',
  );
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginMutation(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isAuthConfigured()) {
      console.error('Owner auth is not configured. Set CLEON_OWNER_ACCESS_KEY and CLEON_SESSION_SECRET.');
      return NextResponse.json({ error: 'Owner auth is not configured' }, { status: 503 });
    }

    const body = await req.json().catch(() => null) as { accessKey?: unknown } | null;
    const accessKey = typeof body?.accessKey === 'string' ? body.accessKey : '';

    if (!verifyOwnerAccessKey(accessKey)) {
      await recordFailedLogin(req);
      return NextResponse.json({ error: 'Invalid access key' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, isOwner: true });
    setOwnerSessionCookie(response);
    return response;
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Unable to unlock owner session');
    const status = message.startsWith('Too many') ? 429 : 500;
    if (status === 500) console.error('[Owner Login Error]:', error);

    return NextResponse.json({ error: message }, { status });
  }
}

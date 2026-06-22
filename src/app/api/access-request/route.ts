import { NextResponse } from 'next/server';

import { barkNotification } from '@/lib/notification';
import { isSameOriginMutation } from '@/lib/auth/session';
import { assertWindowRateLimit, hashedRateLimitKey } from '@/lib/redis';
import { getClientIp, getCoarseIp, getUserAgentSummary } from '@/lib/request';

export const runtime = 'nodejs';

const ACCESS_REQUEST_MAX_CHARS = 500;

function normalizeMessage(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, ACCESS_REQUEST_MAX_CHARS);
}

function normalizePath(value: unknown) {
  if (typeof value !== 'string') return '/';
  const path = value.trim();
  if (!path.startsWith('/')) return '/';
  return path.slice(0, 180);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginMutation(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ip = getClientIp(req);
    const userAgent = getUserAgentSummary(req);

    await assertWindowRateLimit(
      hashedRateLimitKey('access-request', [ip]),
      3,
      60 * 60,
      'Too many access requests. Try again later.',
    );

    const body = await req.json().catch(() => null) as { message?: unknown; path?: unknown } | null;
    const message = normalizeMessage(body?.message);
    const path = normalizePath(body?.path);

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const requestUrl = new URL(req.url);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;
    const requestedAt = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    const sent = await barkNotification.sendNotification({
      title: 'Cleon 访问请求',
      body: [
        `留言: ${message}`,
        `页面: ${path}`,
        `时间: ${requestedAt}`,
        `IP: ${getCoarseIp(ip)}`,
        `UA: ${userAgent}`,
      ].join('\n'),
      group: 'Cleon',
      category: '访问',
      sound: 'shake.caf',
      url: `${siteUrl}${path}`,
    });

    if (!sent) {
      return NextResponse.json({ error: 'Unable to send access request' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Unable to send access request');
    const status = message.startsWith('Too many') ? 429 : 500;
    if (status === 500) console.error('[Access Request Error]:', error);

    return NextResponse.json({ error: message }, { status });
  }
}

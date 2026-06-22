import { NextResponse } from 'next/server';
import {
  PASTE_LIMIT,
  PASTE_MAX_CHARS,
  PASTE_TTL_SECONDS,
  PasteStoreConfigurationError,
  assertPasteRateLimit,
  clearPastes,
  getRecentPastes,
  savePaste,
} from '@/lib/paste-bin';
import { requireOwnerRequest } from '@/lib/auth/session';
import { getClientIp } from '@/lib/request';

export const runtime = 'nodejs';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getPublicPasteError(error: unknown, fallback: string) {
  if (error instanceof PasteStoreConfigurationError) {
    return error.message;
  }

  return fallback;
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined;
}

export async function GET(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const data = await getRecentPastes();

    return NextResponse.json({
      success: true,
      data,
      limit: PASTE_LIMIT,
      ttlSeconds: PASTE_TTL_SECONDS,
    });
  } catch (error: unknown) {
    console.error('[Paste Bin GET Error]:', error);
    return NextResponse.json({
      success: false,
      error: getPublicPasteError(error, 'Unable to load recent pastes'),
      details: process.env.NODE_ENV !== 'production' ? getErrorStack(error) : undefined,
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const source = typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 40)
      : 'web';

    if (!content) {
      return NextResponse.json({ success: false, error: 'Paste content is required' }, { status: 400 });
    }

    if (content.length > PASTE_MAX_CHARS) {
      return NextResponse.json({
        success: false,
        error: `Paste content must be ${PASTE_MAX_CHARS.toLocaleString()} characters or less`,
      }, { status: 413 });
    }

    await assertPasteRateLimit(getClientIp(req));
    const item = await savePaste(content, source);

    return NextResponse.json({
      success: true,
      data: item,
      limit: PASTE_LIMIT,
      ttlSeconds: PASTE_TTL_SECONDS,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Paste Bin POST Error]:', error);
    const message = error instanceof PasteStoreConfigurationError
      ? error.message
      : getErrorMessage(error, 'Unable to save paste');

    return NextResponse.json({
      success: false,
      error: message,
      details: process.env.NODE_ENV !== 'production' ? getErrorStack(error) : undefined,
    }, { status: message.startsWith('Too many') ? 429 : 500 });
  }
}

export async function DELETE(req: Request) {
  const unauthorized = requireOwnerRequest(req);
  if (unauthorized) return unauthorized;

  try {
    await clearPastes();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[Paste Bin DELETE Error]:', error);
    return NextResponse.json({
      success: false,
      error: getPublicPasteError(error, 'Unable to clear recent pastes'),
      details: process.env.NODE_ENV !== 'production' ? getErrorStack(error) : undefined,
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import {
  PASTE_LIMIT,
  PASTE_MAX_CHARS,
  PASTE_TTL_SECONDS,
  assertPasteRateLimit,
  clearPastes,
  createPasteSpace,
  getRecentPastes,
  normalizePasteSpace,
  savePaste,
} from '@/lib/paste-bin';

export const runtime = 'nodejs';

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

function parseSpace(req: Request) {
  const { searchParams } = new URL(req.url);
  return normalizePasteSpace(searchParams.get('space'));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined;
}

export async function GET(req: Request) {
  try {
    const space = parseSpace(req);

    if (!space) {
      return NextResponse.json({
        success: true,
        space: createPasteSpace(),
        data: [],
        limit: PASTE_LIMIT,
        ttlSeconds: PASTE_TTL_SECONDS,
      });
    }

    const data = await getRecentPastes(space);

    return NextResponse.json({
      success: true,
      space,
      data,
      limit: PASTE_LIMIT,
      ttlSeconds: PASTE_TTL_SECONDS,
    });
  } catch (error: unknown) {
    console.error('[Paste Bin GET Error]:', error);
    return NextResponse.json({
      success: false,
      error: 'Unable to load recent pastes',
      details: process.env.NODE_ENV !== 'production' ? getErrorStack(error) : undefined,
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const space = normalizePasteSpace(typeof body.space === 'string' ? body.space : null);
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const source = typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 40)
      : 'web';

    if (!space) {
      return NextResponse.json({ success: false, error: 'Paste space is invalid' }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ success: false, error: 'Paste content is required' }, { status: 400 });
    }

    if (content.length > PASTE_MAX_CHARS) {
      return NextResponse.json({
        success: false,
        error: `Paste content must be ${PASTE_MAX_CHARS.toLocaleString()} characters or less`,
      }, { status: 413 });
    }

    await assertPasteRateLimit(space, getClientIp(req));
    const item = await savePaste(space, content, source);

    return NextResponse.json({
      success: true,
      data: item,
      limit: PASTE_LIMIT,
      ttlSeconds: PASTE_TTL_SECONDS,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[Paste Bin POST Error]:', error);
    const message = getErrorMessage(error, 'Unable to save paste');

    return NextResponse.json({
      success: false,
      error: message,
      details: process.env.NODE_ENV !== 'production' ? getErrorStack(error) : undefined,
    }, { status: message.startsWith('Too many') ? 429 : 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const space = parseSpace(req);

    if (!space) {
      return NextResponse.json({ success: false, error: 'Paste space is invalid' }, { status: 400 });
    }

    await clearPastes(space);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[Paste Bin DELETE Error]:', error);
    return NextResponse.json({
      success: false,
      error: 'Unable to clear recent pastes',
      details: process.env.NODE_ENV !== 'production' ? getErrorStack(error) : undefined,
    }, { status: 500 });
  }
}

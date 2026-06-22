import { NextResponse } from 'next/server';

import { clearOwnerSessionCookie, isSameOriginMutation } from '@/lib/auth/session';

export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const response = NextResponse.json({ success: true, isOwner: false });
  clearOwnerSessionCookie(response);
  return response;
}

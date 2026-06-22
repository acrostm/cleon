import { NextResponse } from 'next/server';

import { isOwnerRequest } from '@/lib/auth/session';

export async function GET(req: Request) {
  return NextResponse.json({ isOwner: isOwnerRequest(req) });
}

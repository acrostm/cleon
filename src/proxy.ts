import { NextResponse, type NextRequest } from 'next/server';

import { isOwnerSessionValue, OWNER_SESSION_COOKIE } from '@/lib/auth/session';

const PROTECTED_PAGE_PREFIXES = ['/clipboard', '/admin'];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));

  if (!isProtectedPage) {
    return NextResponse.next();
  }

  const isOwner = isOwnerSessionValue(request.cookies.get(OWNER_SESSION_COOKIE)?.value);
  if (isOwner) {
    return NextResponse.next();
  }

  const redirectUrl = new URL('/', request.url);
  redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|webmanifest)$).*)',
  ],
};

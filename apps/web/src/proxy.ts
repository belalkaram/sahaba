/**
 * R1B — Next.js Proxy (the `middleware` file convention was renamed to `proxy` in Next 16).
 * Protects authenticated routes by checking for a stored auth token.
 *
 * This is a REDIRECT guard only — it does NOT verify the token cryptographically.
 * Real authorization happens on the backend for every API request.
 *
 * Protected route groups:
 *   /teacher/*   — staff/admin experience
 *   /student/*   — student experience
 *   /parent/*    — parent experience
 *   /admin/*     — admin experience
 *   /notifications/* — any signed-in tenant user
 *   /platform/*  — NOT here: platform session lives in sessionStorage, guarded client-side
 *
 * Public routes (no token required):
 *   /login, /register-school, /, /about, /pricing, /contact, /privacy, /terms
 *
 * `/` (LANDING-V2 L0): a signed-in visitor is sent to their dashboard before the landing renders,
 * so the landing can stay a static page and never flashes for them.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Cookie / localStorage key used by token-store.ts */
const TOKEN_COOKIE_KEY = 'lms_auth_token';
/** Dashboard path of the signed-in experience, mirrored by token-store.ts */
const HOME_COOKIE_KEY = 'lms_home';

/** The cookie is client-written, so only these exact targets are honoured (no open redirect). */
const HOME_PATHS = ['/admin', '/teacher/dashboard', '/parent/dashboard', '/student/dashboard'];

const PROTECTED_PREFIXES = [
  '/teacher',
  '/staff',
  '/student',
  '/parent',
  '/admin',
  '/notifications',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tokenFromCookie = request.cookies.get(TOKEN_COOKIE_KEY)?.value;

  if (pathname === '/') {
    const home = request.cookies.get(HOME_COOKIE_KEY)?.value;
    if (tokenFromCookie && home && HOME_PATHS.includes(home)) {
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // The token lives in localStorage; token-store mirrors it to a cookie so this guard can see it.
  // If the cookie is absent, redirect to login.
  if (!tokenFromCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/teacher/:path*',
    '/staff/:path*',
    '/student/:path*',
    '/parent/:path*',
    '/admin/:path*',
    '/notifications/:path*',
  ],
};

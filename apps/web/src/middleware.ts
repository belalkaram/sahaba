/**
 * R1B — Next.js Middleware
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
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Cookie / localStorage key used by token-store.ts */
const TOKEN_COOKIE_KEY = 'lms_auth_token';

const PROTECTED_PREFIXES = [
  '/teacher',
  '/staff',
  '/student',
  '/parent',
  '/admin',
  '/notifications',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for token in cookies (Next.js middleware cannot read localStorage)
  // The token-store should mirror the token to a cookie for SSR middleware checks.
  // If cookie is absent, redirect to login.
  const tokenFromCookie = request.cookies.get(TOKEN_COOKIE_KEY)?.value;

  if (!tokenFromCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/teacher/:path*',
    '/staff/:path*',
    '/student/:path*',
    '/parent/:path*',
    '/admin/:path*',
    '/notifications/:path*',
  ],
};


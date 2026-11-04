/**
 * R1B — Token Store
 * Manages auth token persistence in localStorage + mirrors to cookie for middleware.
 * SSR-safe (window guard for server-side rendering).
 */

const TOKEN_KEY = 'lms_auth_token';
const TENANT_KEY = 'lms_tenant_slug';

/** Cookie maxAge: 8 hours (session-level, not permanent) */
const COOKIE_MAX_AGE = 60 * 60 * 8;

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=;path=/;max-age=0`;
}

export const tokenStore = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
    setCookie(TOKEN_KEY, token, COOKIE_MAX_AGE);
  },
  clearToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    deleteCookie(TOKEN_KEY);
  },
  getTenant: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TENANT_KEY);
  },
  setTenant: (slug: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TENANT_KEY, slug);
  },
  clearAll: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
    deleteCookie(TOKEN_KEY);
  },
};

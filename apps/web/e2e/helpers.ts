import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export interface Fixtures {
  tenant: string;
  password: string;
  platform_email: string;
  provisioned_slug: string;
  coupon: { id: string; code: string; secret: string };
  users: Record<'owner' | 'teacher' | 'finance' | 'assistant' | 'student' | 'student2' | 'parent', string>;
  ids: Record<'course' | 'lesson' | 'class' | 'session' | 'assignment' | 'exam' | 'package' | 'student' | 'student2' | 'student_user' | 'payment', string>;
}

export const API = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';

const EMPTY: Fixtures = {
  tenant: '',
  password: '',
  platform_email: '',
  provisioned_slug: '',
  coupon: { id: '', code: '', secret: '' },
  users: new Proxy({}, { get: () => '' }) as Fixtures['users'],
  ids: new Proxy({}, { get: () => '' }) as Fixtures['ids'],
};

/** Test files are also loaded before global setup runs, when the file may not exist yet. */
export function fixtures(): Fixtures {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname, '.results/fixtures.json'), 'utf8'));
  } catch {
    return EMPTY;
  }
}

const tokens = new Map<string, string>();

async function apiLogin(page: Page, email: string): Promise<string> {
  const cached = tokens.get(email);
  if (cached) return cached;
  const f = fixtures();
  const res = await page.request.post(`${API}/auth/login`, {
    headers: { 'X-Tenant-Slug': f.tenant, Accept: 'application/json' },
    data: { identifier: email, email, password: f.password },
  });
  if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()}`);
  const token = (await res.json()).data.token as string;
  tokens.set(email, token);
  return token;
}

/** Signs in through the API and stores the session the way the app does. */
export async function signIn(page: Page, email: string, theme: 'light' | 'dark' = 'light') {
  const f = fixtures();
  const token = await apiLogin(page, email);
  await page.context().addCookies([{ name: 'lms_auth_token', value: encodeURIComponent(token), url: process.env.E2E_BASE_URL ?? 'http://localhost:3000' }]);
  await page.addInitScript(
    ([t, slug, th]) => {
      localStorage.setItem('lms_auth_token', t);
      localStorage.setItem('lms_tenant_slug', slug);
      localStorage.setItem('lms_theme', th);
    },
    [token, f.tenant, theme],
  );
}

export async function signInPlatform(page: Page, theme: 'light' | 'dark' = 'light') {
  const f = fixtures();
  const res = await page.request.post(`${API}/platform/auth/login`, {
    headers: { Accept: 'application/json' },
    data: { email: f.platform_email, password: f.password },
  });
  if (!res.ok()) throw new Error(`Platform login failed: ${res.status()}`);
  const token = (await res.json()).data.token;
  await page.addInitScript(
    ([t, th]) => {
      sessionStorage.setItem('platform_admin_token', t);
      localStorage.setItem('lms_theme', th);
    },
    [token, theme],
  );
}

/** Waits until the page has finished loading data (no skeleton, network quiet). */
export async function settled(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(700); // entrance animations
}

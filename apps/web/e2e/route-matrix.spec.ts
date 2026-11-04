import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixtures, settled, signIn, signInPlatform } from './helpers';

/**
 * R9-4 / R9-5: every route × every experience × {390, 1440} × {light, dark}.
 * Per route: no crash, no client errors, no horizontal overflow, no critical/serious axe violation.
 * Screenshots go to docs/recovery-reports/visual/<date>/ for review.
 * E2E_THEMES=light,dark and E2E_WIDTHS=390,1440 narrow the run.
 */

const f = fixtures();
const id = f.ids;

const PUBLIC = ['/', '/login', '/pricing', '/about', '/contact', '/privacy', '/terms', '/register-school', '/platform/login'];

const ROUTES: Record<string, { user: string | 'platform' | null; routes: string[] }> = {
  public: { user: null, routes: PUBLIC },
  student: {
    user: f.users.student,
    routes: [
      '/student/dashboard',
      '/student/courses',
      `/student/courses/${id.course}`,
      `/student/courses/${id.course}/lessons/${id.lesson}`,
      `/student/courses/${id.course}/assignments/${id.assignment}`,
      '/student/assignments',
      '/student/exams',
      '/student/assessments',
      '/student/meetings',
      '/student/attendance',
      '/student/grades',
      '/student/plans',
      `/student/plans/${id.package}/pay`,
      '/student/subscriptions',
      '/student/payments',
      '/student/card',
      '/student/profile',
      '/notifications',
      '/notifications/preferences',
    ],
  },
  teacher: {
    user: f.users.teacher,
    routes: [
      '/teacher/dashboard',
      '/teacher/courses',
      `/teacher/courses/${id.course}`,
      `/teacher/courses/${id.course}/exams/${id.exam}/builder`,
      '/teacher/students',
      `/teacher/students/${id.student}`,
      '/teacher/attendance',
      `/teacher/attendance/scan/${id.session}`,
      '/teacher/classes',
      `/teacher/classes/${id.class}`,
      '/teacher/sessions',
      `/teacher/sessions/${id.session}`,
      '/teacher/assessments',
      '/teacher/grading',
      '/teacher/meetings',
      '/teacher/media',
      '/teacher/analytics',
      '/teacher/reports',
      '/teacher/assistant',
    ],
  },
  finance: { user: f.users.finance, routes: ['/teacher/dashboard', '/teacher/payments', '/teacher/reports'] },
  parent: {
    user: f.users.parent,
    routes: ['/parent/dashboard', '/parent/children', `/parent/children/${id.student}`, '/parent/reports', '/notifications'],
  },
  admin: {
    user: f.users.owner,
    routes: [
      '/admin',
      '/admin/users',
      '/admin/users/new',
      `/admin/users/${id.student_user}`,
      '/admin/students/import',
      '/admin/roles',
      '/admin/branches',
      '/admin/packages',
      '/admin/reports',
      '/admin/audit',
      '/admin/integrations',
      '/admin/academic-settings',
      '/admin/settings',
      '/teacher/payments',
      '/teacher/credentials',
    ],
  },
  platform: {
    user: 'platform',
    routes: ['/platform/dashboard', '/platform/tenants', '/platform/support-sessions', '/platform/audit', '/platform/settings'],
  },
};

const WIDTHS = (process.env.E2E_WIDTHS ?? '390,1440').split(',').map(Number);
const THEMES = (process.env.E2E_THEMES ?? 'light,dark').split(',') as ('light' | 'dark')[];
const AUDIT_DIR = path.resolve(__dirname, '../../../docs/recovery-reports/visual', new Date().toISOString().slice(0, 10));

function collectClientErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Service worker registration depends on the browser context, not on the page under test.
    if (text.includes('Service Worker')) return;
    // Failed requests are reported below with their URL.
    if (text.startsWith('Failed to load resource')) return;
    errors.push(`console: ${text}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.request().method()} ${r.url()}`);
  });
  return errors;
}

for (const [experience, { user, routes }] of Object.entries(ROUTES)) {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test.describe(`${experience} ${theme} ${width}`, () => {
        for (const route of routes) {
          test(route.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id'), async ({ page }) => {
            await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
            if (user === 'platform') await signInPlatform(page, theme);
            else if (user) await signIn(page, user, theme);
            else await page.addInitScript((t) => localStorage.setItem('lms_theme', t), theme);

            const errors = collectClientErrors(page);
            const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
            expect(response?.status(), 'document status').toBeLessThan(500);
            await settled(page);

            // Stayed on the route (not bounced to login or a 403) and the error page did not render.
            if (user) expect(new URL(page.url()).pathname, 'no redirect').toBe(route);
            await expect(page.getByText('حدث خطأ أثناء تحميل الصفحة')).toHaveCount(0);
            await expect(page.getByText('غير مصرح بالدخول')).toHaveCount(0);

            fs.mkdirSync(AUDIT_DIR, { recursive: true });
            const name = `${experience}__${route.replace(/[^a-z0-9-]+/gi, '_').slice(0, 70)}__${width}__${theme}.jpg`;
            await page.screenshot({ path: path.join(AUDIT_DIR, name), type: 'jpeg', quality: 55, fullPage: true });

            const overflow = await page.evaluate(() => {
              const excess = document.documentElement.scrollWidth - window.innerWidth;
              if (excess <= 1) return [];
              // Name the widest offenders so the failure points at the element.
              return [...document.querySelectorAll('body *')]
                .filter((el) => {
                  const r = el.getBoundingClientRect();
                  if (r.width === 0 || getComputedStyle(el).position === 'fixed') return false;
                  return r.right > window.innerWidth + 1 || r.left < -1;
                })
                .slice(0, 4)
                .map((el) => `${excess}px ${el.tagName}.${String(el.getAttribute('class')).slice(0, 80)}`);
            });
            expect(overflow, 'horizontal overflow').toEqual([]);

            const axe = await new AxeBuilder({ page }).analyze();
            const blocking = axe.violations
              .filter((v) => v.impact === 'critical' || v.impact === 'serious')
              .map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0]?.target.join(' ')}`);
            expect(blocking, 'axe critical/serious').toEqual([]);
            expect(errors, 'client errors').toEqual([]);
          });
        }
      });
    }
  }
}

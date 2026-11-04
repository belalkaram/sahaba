import { defineConfig } from '@playwright/test';

/**
 * R9 E2E. Expects the API and web apps to be running:
 *   E2E_BASE_URL (default http://localhost:3000), E2E_API_URL (default http://localhost:8000/api/v1).
 * Global setup rebuilds a dedicated tenant with `php artisan lms:seed-e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  outputDir: './e2e/.results/artifacts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'e2e/.results/report.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'ar-SA',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

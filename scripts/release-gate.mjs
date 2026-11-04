#!/usr/bin/env node
// R9-6 — Release gate. One implementation for Windows and CI:
//   node scripts/release-gate.mjs [--skip-e2e]
// Writes docs/project-management/release-evidence.json (per-gate command, duration, result, commit).
// Requires for the E2E gate: API on E2E_API_URL and web on E2E_BASE_URL (see apps/web/playwright.config.ts).
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = path.join(ROOT, 'apps/api');
const WEB = path.join(ROOT, 'apps/web');
const MATRIX = path.join(ROOT, 'docs/audit/2026-10-30-system-gap-analysis/04-capability-coverage-matrix.md');
const LANDING = path.join(WEB, 'src/features/landing/content.ts');
const EVIDENCE = path.join(ROOT, 'docs/project-management/release-evidence.json');
const skipE2e = process.argv.includes('--skip-e2e');

const results = [];

function record(name, command, started, passed, detail = '') {
  const duration = Math.round((Date.now() - started) / 1000);
  results.push({ gate: name, command, duration_seconds: duration, result: passed ? 'PASS' : 'FAIL', detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name} (${duration}s)${detail ? ` — ${detail}` : ''}`);
}

function run(name, command, cwd) {
  const started = Date.now();
  const res = spawnSync(command, { cwd, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const passed = res.status === 0;
  const tail = passed ? '' : `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n').slice(-3).join(' | ').slice(0, 400);
  record(name, command, started, passed, tail);
}

function check(name, description, fn) {
  const started = Date.now();
  try {
    const problem = fn();
    record(name, description, started, !problem, problem || '');
  } catch (e) {
    record(name, description, started, false, String(e.message));
  }
}

console.log('Sahaba release gate\n');

run('Pint (code style)', 'vendor/bin/pint --test', API);
// PHPUnit includes: permission catalog integrity, role matrix, OpenAPI coverage, security invariants.
run('PHPUnit (includes role matrix + OpenAPI coverage)', 'php artisan test', API);
run('Composer audit', 'composer audit --no-interaction', API);
run('TypeScript', 'npx tsc --noEmit', WEB);
run('ESLint', 'npm run lint', WEB);
run('Design system guard', 'npm run lint:design', WEB);
run('Navigation unit tests', 'npm test', WEB);
run('Production build', 'npm run build', WEB);
run('npm audit (high)', 'npm audit --audit-level=high', WEB);

if (skipE2e) {
  results.push({ gate: 'E2E + accessibility (Playwright)', command: 'npx playwright test', duration_seconds: 0, result: 'SKIPPED', detail: '--skip-e2e' });
  console.log('SKIP  E2E + accessibility (Playwright)');
} else {
  run('E2E + accessibility (Playwright)', 'npx playwright test', WEB);
}

check('Coverage matrix', 'no in-scope BROKEN/SIMULATED rows in 04-capability-coverage-matrix.md', () => {
  const rows = fs
    .readFileSync(MATRIX, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('|') && /\*\*(BROKEN|SIMULATED)\*\*|\|\s*(BROKEN|SIMULATED)\b/.test(line) && !/DEFERRED \(ADR-/.test(line));
  return rows.length ? `${rows.length} row(s) still BROKEN/SIMULATED` : '';
});

check('Landing content', 'no placeholder marketing content (OD-21)', () => {
  const count = (fs.readFileSync(LANDING, 'utf8').match(/sample:\s*true/g) ?? []).length;
  return count ? `${count} placeholder item(s) still marked sample: true` : '';
});

let commit = 'unknown';
let dirty = false;
try {
  commit = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim().length > 0;
} catch {
  // not a git checkout
}

const failed = results.filter((r) => r.result === 'FAIL');
const skipped = results.filter((r) => r.result === 'SKIPPED');

fs.writeFileSync(
  EVIDENCE,
  `${JSON.stringify({ generated_at: new Date().toISOString(), commit, working_tree_dirty: dirty, passed: failed.length === 0 && skipped.length === 0, gates: results }, null, 2)}\n`,
);

console.log(`\n${results.length - failed.length - skipped.length}/${results.length} gates passed. Evidence: docs/project-management/release-evidence.json`);
if (failed.length || skipped.length) {
  console.log('STATUS: NOT PRODUCTION_READY');
  process.exit(1);
}
console.log('STATUS: all gates passed');

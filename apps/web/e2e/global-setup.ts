import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const FIXTURES_PATH = path.resolve(__dirname, '.results/fixtures.json');

/** Rebuilds the dedicated E2E tenant so every run starts from the same data. */
export default function globalSetup() {
  const api = path.resolve(__dirname, '../../api');
  fs.mkdirSync(path.dirname(FIXTURES_PATH), { recursive: true });
  execFileSync('php', ['artisan', 'lms:seed-e2e', `--json=${FIXTURES_PATH}`], { cwd: api, stdio: 'inherit' });
}

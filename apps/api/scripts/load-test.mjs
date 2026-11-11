// Dev tool: closed-loop load test (GET only) against a running API. No dependencies.
//
//   node scripts/load-test.mjs --base=http://localhost:8100/api/v1 --tenant=almustaqbal \
//        --concurrency=8 --duration=30 [--role=student|teacher|admin|all]
//
// Each virtual user logs in once (the demo accounts, password123 — these only exist on dev databases), then loops over the
// role's read endpoints until the time is up. Reports per endpoint: requests, errors, p50 / p95 / max latency, and
// the overall throughput. Run it against the cluster (scripts/dev-api-cluster.mjs): a single `artisan serve` queues.
const opt = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const BASE = opt('base', 'http://localhost:8100/api/v1').replace(/\/$/, '');
const TENANT = opt('tenant', 'almustaqbal');
const CONCURRENCY = Number(opt('concurrency', 8));
const DURATION = Number(opt('duration', 30)) * 1000;
const ROLE = opt('role', 'all');

const ACCOUNTS = {
  student: { identifier: 'student@almustaqbal.edu', paths: ['/auth/me', '/notifications?page=1', '/courses', '/me/courses', '/student/academies'] },
  teacher: { identifier: 'teacher@almustaqbal.edu', paths: ['/auth/me', '/students?page=1&per_page=20&include=analytics', '/courses', '/classes', '/notifications?page=1'] },
  admin: { identifier: 'admin@almustaqbal.edu', paths: ['/auth/me', '/users?per_page=20', '/students?page=1&per_page=20', '/staff', '/registration-requests'] },
};
const roles = ROLE === 'all' ? Object.keys(ACCOUNTS) : [ROLE];

const headers = (token) => ({ 'X-Tenant-Slug': TENANT, Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

async function login(role) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: ACCOUNTS[role].identifier, password: 'password123' }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`login ${role} failed: ${res.status}`);
  return json.data.token;
}

const stats = new Map(); // key -> { ms: number[], errors: number, statuses: Map }
const record = (key, ms, status, failed) => {
  const s = stats.get(key) ?? { ms: [], errors: 0, statuses: new Map() };
  s.ms.push(ms);
  if (failed) s.errors++;
  s.statuses.set(status, (s.statuses.get(status) ?? 0) + 1);
  stats.set(key, s);
};
const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] ?? 0;

console.log(`logging in (${roles.join(', ')}) …`);
const tokens = Object.fromEntries(await Promise.all(roles.map(async (r) => [r, await login(r)])));

const deadline = Date.now() + DURATION;
let total = 0;
const user = async (id) => {
  const role = roles[id % roles.length];
  const { paths } = ACCOUNTS[role];
  let i = id; // stagger the starting endpoint
  while (Date.now() < deadline) {
    const path = paths[i++ % paths.length];
    const t = performance.now();
    let status = 0;
    let failed = false;
    try {
      const res = await fetch(`${BASE}${path}`, { headers: headers(tokens[role]), signal: AbortSignal.timeout(60_000) });
      await res.arrayBuffer();
      status = res.status;
      failed = !res.ok;
    } catch {
      status = 'timeout/network';
      failed = true;
    }
    record(`${role.padEnd(7)} ${path}`, performance.now() - t, status, failed);
    total++;
  }
};

console.log(`${CONCURRENCY} virtual users for ${DURATION / 1000}s against ${BASE} …`);
const started = performance.now();
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => user(i)));
const seconds = (performance.now() - started) / 1000;

console.log('\nendpoint                                              reqs  err   p50     p95     max');
for (const [key, s] of [...stats].sort()) {
  console.log(`${key.padEnd(52)} ${String(s.ms.length).padStart(4)} ${String(s.errors).padStart(4)}  ${(pct(s.ms, 50) / 1000).toFixed(1).padStart(5)}s ${(pct(s.ms, 95) / 1000).toFixed(1).padStart(5)}s ${(Math.max(...s.ms) / 1000).toFixed(1).padStart(5)}s`);
}
const all = [...stats.values()].flatMap((s) => s.ms);
const errors = [...stats.values()].reduce((n, s) => n + s.errors, 0);
console.log(`\ntotal ${total} requests in ${seconds.toFixed(1)}s = ${(total / seconds).toFixed(2)} req/s, ${errors} errors (${((errors / Math.max(1, total)) * 100).toFixed(1)}%), p50 ${(pct(all, 50) / 1000).toFixed(1)}s, p95 ${(pct(all, 95) / 1000).toFixed(1)}s`);

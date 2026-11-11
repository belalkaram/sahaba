// Dev tool: run the API as N PHP processes behind a round-robin proxy (default 4 workers on :8100).
//
//   node scripts/dev-api-cluster.mjs [--workers=4] [--port=8100]
//
// Why: `php artisan serve` handles ONE request at a time on Windows (PHP_CLI_SERVER_WORKERS is unsupported there), so
// with a remote database every slow request blocks all the others. Several workers behave like php-fpm in
// production and let you see real concurrency limits. Each worker keeps its own persistent database connections
// (DB_PERSISTENT=true), so total connections = workers x 2.
// Point the web app at it with NEXT_PUBLIC_API_URL=http://localhost:8100/api/v1. Stop with Ctrl+C.
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const WORKERS = arg('workers', 4);
const PORT = arg('port', 8100);
const BASE = PORT + 1; // workers listen on PORT+1 … PORT+WORKERS

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const router = path.join(root, 'vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php');

const children = [];
for (let i = 0; i < WORKERS; i++) {
  const child = spawn('php', ['-S', `127.0.0.1:${BASE + i}`, router], {
    cwd: path.join(root, 'public'),
    env: { ...process.env, PHP_CLI_SERVER_WORKERS: '1' },
    stdio: 'ignore',
  });
  child.on('exit', (code) => console.error(`worker ${BASE + i} exited (${code})`));
  children.push(child);
}

let turn = 0;
const proxy = http.createServer((req, res) => {
  const target = BASE + (turn++ % WORKERS);
  const upstream = http.request({ host: '127.0.0.1', port: target, method: req.method, path: req.url, headers: req.headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ error: { code: 'WORKER_UNAVAILABLE', message: 'worker unavailable' } }));
  });
  req.pipe(upstream);
});
proxy.listen(PORT, '0.0.0.0', () => console.log(`API cluster: http://localhost:${PORT}  (${WORKERS} PHP workers on ${BASE}-${BASE + WORKERS - 1})`));

const stop = () => {
  children.forEach((c) => c.kill());
  proxy.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

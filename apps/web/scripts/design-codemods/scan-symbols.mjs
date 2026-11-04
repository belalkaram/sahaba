// Lists emoji and Unicode-symbol "icons" in src (excluding the icon system itself).
// Usage: node scripts/design-codemods/scan-symbols.mjs [--summary]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../src');
// © ® ™ are legitimate typography, not icons.
const SYMBOLS = /(?![©®™])\p{Extended_Pictographic}|[←→✕✓✔✖↵↗↑↓▼▶]/u;

const hits = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !p.includes(`${path.sep}icons${path.sep}`)) {
      fs.readFileSync(p, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (SYMBOLS.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) {
            hits.push(`${path.relative(ROOT, p).replaceAll('\\', '/')}:${i + 1}: ${line.trim().slice(0, 160)}`);
          }
        });
    }
  }
})(ROOT);

if (process.argv.includes('--summary')) console.log(`${hits.length} occurrences`);
else console.log(hits.join('\n'));
process.exitCode = hits.length ? 1 : 0;

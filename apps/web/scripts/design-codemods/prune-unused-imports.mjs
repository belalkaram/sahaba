// Removes import specifiers that ESLint reports as unused (after the design codemods).
//   node scripts/design-codemods/prune-unused-imports.mjs [paths...]   (default: src)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const WEB = path.resolve(import.meta.dirname, '../..');
const targets = process.argv.slice(2);
let report;
try {
  report = execFileSync('npx', ['eslint', '--format', 'json', ...(targets.length ? targets : ['src'])], {
    cwd: WEB,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  report = e.stdout; // eslint exits non-zero when it finds problems
}

let removed = 0;
for (const file of JSON.parse(report)) {
  const unused = file.messages
    .filter((m) => m.ruleId === '@typescript-eslint/no-unused-vars')
    .map((m) => ({ name: m.message.match(/^'([^']+)'/)?.[1], line: m.line }))
    .filter((u) => u.name);
  if (!unused.length) continue;
  let src = fs.readFileSync(file.filePath, 'utf8');
  for (const { name } of unused) {
    const importRe = new RegExp(String.raw`import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*(['"][^'"]+['"]);?`, 'g');
    src = src.replace(importRe, (stmt, def, named, from) => {
      const specs = (named ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const keep = specs.filter((s) => s.replace(/^type\s+/, '').split(/\s+as\s+/).pop() !== name);
      const keepDefault = def && def !== name ? def : null;
      if (keep.length === specs.length && keepDefault === (def ?? null)) return stmt;
      removed++;
      if (!keep.length && !keepDefault) return '';
      const typeOnly = /^import\s+type\s/.test(stmt) ? 'type ' : '';
      const parts = [keepDefault, keep.length ? `{ ${keep.join(', ')} }` : null].filter(Boolean).join(', ');
      return `import ${typeOnly}${parts} from ${from};`;
    });
  }
  fs.writeFileSync(file.filePath, src.replace(/\n{3,}/g, '\n\n'));
}
console.log(`${removed} unused import specifiers removed`);

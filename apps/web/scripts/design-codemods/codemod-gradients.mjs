// R7 design codemod — collapses legacy two-tone gradients (after codemod-classes) into the
// token system: same-family gradients become a flat semantic fill; mixed ones become the
// single allowed brand gradient (bg-gradient-brand).
//   node scripts/design-codemods/codemod-gradients.mjs
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../../src');
const SEM = '(primary|success|warning|danger|info|accent|surface-muted)';
const GRADIENT_RE = new RegExp(
  String.raw`bg-gradient-to-[a-z]{1,2}(\s+)from-${SEM}(\/\d+)?(?:\s+via-${SEM}(\/\d+)?)?\s+to-${SEM}(\/\d+)?`,
  'g',
);

function fix(cls) {
  let out = cls.replace(GRADIENT_RE, (_m, _sp, from, fromOp, _via, _viaOp, to) => {
    if (fromOp) return `bg-${from}${fromOp}`;
    if (from === to) return `bg-${from}`;
    return 'bg-gradient-brand';
  });
  out = out.replace(new RegExp(String.raw`\s*hover:from-${SEM}(\/\d+)?\s+hover:to-${SEM}(\/\d+)?`, 'g'), (_m, from) =>
    from === 'primary' ? ' hover:bg-primary-hover' : ` hover:bg-${from}-hover`,
  );
  // A solid semantic fill needs its paired foreground.
  const solid = out.match(new RegExp(String.raw`(?:^|\s)bg-${SEM}(?=\s|$)`));
  if (solid && solid[1] !== 'surface-muted') out = out.replace(/(^|\s)text-white(?=\s|$)/g, `$1text-${solid[1]}-fg`);
  return out;
}

let changed = 0;
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.tsx')) {
      const before = fs.readFileSync(p, 'utf8');
      const after = before.replace(/(["'`])([^"'`\n]*bg-gradient-to-[^"'`\n]*)\1/g, (_m, q, body) => q + fix(body) + q);
      if (after !== before) {
        fs.writeFileSync(p, after);
        changed++;
      }
    }
  }
})(SRC);
console.log(`${changed} files changed`);

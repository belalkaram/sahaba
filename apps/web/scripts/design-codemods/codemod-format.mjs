// R7 design codemod — routes ad-hoc number/date formatting through src/lib/format.ts
// (OD-17 Arabic-Indic digits, OD-18 explicit Gregorian calendar).
//   node scripts/design-codemods/codemod-format.mjs
//
//   new Date(x).toLocaleDateString('ar-EG'[, {…month:'short'…}]) → formatDate(x) | formatDateShort(x)
//   new Date(x).toLocaleString('ar-EG'[, …])                      → formatDateTime(x)
//   new Date(x).toLocaleTimeString('ar-EG'[, …])                  → formatTime(x)
//   `${n.toLocaleString()} ر.س` / n.toLocaleString()              → formatCurrency(n) / formatNumber(n)
//   (expr).toFixed(d)                                             → formatNumber(expr, d)
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../../src');

/** Index of the matching closing paren for the "(" at `open`. */
function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

function transform(src) {
  const used = new Set();
  let out = src;

  // new Date(…).toLocale*String(…)
  let idx;
  let from = 0;
  while ((idx = out.indexOf('new Date(', from)) !== -1) {
    const open = idx + 'new Date'.length;
    const close = matchParen(out, open);
    if (close === -1) break;
    const rest = out.slice(close + 1);
    const m = rest.match(/^\.(toLocaleDateString|toLocaleString|toLocaleTimeString)\(/);
    if (!m) {
      from = close;
      continue;
    }
    const callOpen = close + 1 + m[0].length - 1;
    const callClose = matchParen(out, callOpen);
    const args = out.slice(callOpen + 1, callClose);
    const inner = out.slice(open + 1, close).trim();
    const arg = inner === '' ? 'new Date()' : inner;
    let fn;
    if (m[1] === 'toLocaleTimeString') fn = 'formatTime';
    else if (m[1] === 'toLocaleString') fn = /dateStyle:\s*'(short|medium)'|hour/.test(args) || !args.includes(',') ? 'formatDateTime' : 'formatDate';
    else fn = /month:\s*'short'/.test(args) ? 'formatDateShort' : 'formatDate';
    if (m[1] === 'toLocaleDateString' && /hour/.test(args)) fn = 'formatDateTime';
    used.add(fn);
    const replacement = `${fn}(${arg})`;
    out = out.slice(0, idx) + replacement + out.slice(callClose + 1);
    from = idx + replacement.length;
  }

  // Currency in template strings: `${expr.toLocaleString()} ر.س`
  out = out.replace(/\$\{([\w.?!\[\]]+)\.toLocaleString\(\)\}\s*ر\.س/g, (_m, expr) => {
    used.add('formatCurrency');
    return `\${formatCurrency(${expr})}`;
  });
  // JSX: {expr.toLocaleString()} ر.س
  out = out.replace(/\{([\w.?!\[\]]+)\.toLocaleString\(\)\}\s*ر\.س/g, (_m, expr) => {
    used.add('formatCurrency');
    return `{formatCurrency(${expr})}`;
  });
  // Remaining number toLocaleString()
  out = out.replace(/([\w.?!\]]+)\.toLocaleString\(\)/g, (_m, expr) => {
    used.add('formatNumber');
    return `formatNumber(${expr})`;
  });
  // (expr).toFixed(d)
  out = out.replace(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)\.toFixed\((\d)\)/g, (_m, expr, d) => {
    used.add('formatNumber');
    return `formatNumber(${expr}, ${d})`;
  });
  // ident.toFixed(d)% → formatPercent
  out = out.replace(/\{([\w.?!]+)\.toFixed\((\d)\)\}%/g, (_m, expr, d) => {
    used.add('formatPercent');
    return `{formatPercent(${expr}, ${d})}`;
  });
  out = out.replace(/([\w.?!]+)\.toFixed\((\d)\)/g, (_m, expr, d) => {
    used.add('formatNumber');
    return `formatNumber(${expr}, ${d})`;
  });

  return { out, used };
}

let files = 0;
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.tsx')) {
      const src = fs.readFileSync(p, 'utf8');
      const { out, used } = transform(src);
      if (out === src) continue;
      let rel = path.relative(path.dirname(p), path.join(SRC, 'lib/format')).replaceAll('\\', '/');
      if (!rel.startsWith('.')) rel = `./${rel}`;
      const existing = out.match(/import \{([^}]*)\} from '[^']*lib\/format';/);
      let final = out;
      if (existing) {
        const names = new Set(existing[1].split(',').map((s) => s.trim()).filter(Boolean));
        used.forEach((n) => names.add(n));
        final = out.replace(existing[0], `import { ${[...names].sort().join(', ')} } from '${rel}';`);
      } else {
        const lastImport = [...out.matchAll(/^import [\s\S]*?from ['"][^'"]+['"];?\s*$/gm)].pop();
        const at = lastImport.index + lastImport[0].length;
        final = out.slice(0, at) + `\nimport { ${[...used].sort().join(', ')} } from '${rel}';` + out.slice(at);
      }
      fs.writeFileSync(p, final);
      files++;
    }
  }
})(SRC);
console.log(`${files} files changed`);

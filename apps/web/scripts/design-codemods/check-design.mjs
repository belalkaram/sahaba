// R7 design guard (CI): fails when app/feature code bypasses the design system.
//   node scripts/design-codemods/check-design.mjs
// Checks src/app and src/features for:
//   - emoji / Unicode symbols used as icons (use Lucide + components/icons/directional)
//   - raw Tailwind palette colors (use semantic tokens: text-fg, bg-primary, text-danger…)
//   - arbitrary pixel font sizes (use the type scale)
//   - hex colors in className strings
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../../src');
const RULES = [
  { name: 'symbol-icon', re: /(?![©®™])\p{Extended_Pictographic}|[←→✕✓✔✖↵↗▼▶]/u, hint: 'use a Lucide icon or IconNext/IconBack' },
  {
    name: 'raw-color',
    re: /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)-(?:emerald|teal|cyan|green|lime|red|rose|amber|yellow|orange|sky|blue|indigo|purple|violet|fuchsia|pink|slate|gray|zinc|neutral|stone)-\d{2,3}\b/,
    hint: 'use semantic tokens (primary, success, warning, danger, info, accent, fg, surface, border)',
  },
  { name: 'arbitrary-font-size', re: /\btext-\[\d+px\]/, hint: 'use the type scale (text-xs … text-5xl)' },
  { name: 'hex-in-class', re: /\b(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/, hint: 'use a token' },
];

const problems = [];
for (const dir of ['app', 'features']) {
  (function walk(d) {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) {
        fs.readFileSync(p, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
            for (const rule of RULES) {
              if (rule.re.test(line)) problems.push(`${path.relative(SRC, p).replaceAll('\\', '/')}:${i + 1}  ${rule.name} — ${rule.hint}`);
            }
          });
      }
    }
  })(path.join(SRC, dir));
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n✖ ${problems.length} design-system violation(s)`);
  process.exit(1);
}
console.log('✔ design-system check passed');

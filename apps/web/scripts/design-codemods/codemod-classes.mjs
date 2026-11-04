// R7 design codemod — Tailwind class migration to the Sahaba token system.
//
//   node scripts/design-codemods/codemod-classes.mjs [--dry] [paths...]
//
// Operates on string literals that look like class lists. Per literal it rewrites:
//   1. text-white → semantic foreground, chosen from the sibling background in the same literal
//   2. raw palette colors (emerald/red/amber/sky/slate/…) → semantic tokens
//   3. arbitrary font sizes/radii → scale steps; old Tailwind radius names → same pixel size on
//      the new radius scale
//   4. physical → logical properties (RTL authored: right = start, left = end)
// Files listed in KEEP were authored against the new system and are skipped.
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../../src');
const DRY = process.argv.includes('--dry');
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const KEEP = new Set(
  [
    'components/ui/button.tsx',
    'components/ui/card.tsx',
    'components/ui/badge.tsx',
    'components/ui/field.tsx',
    'components/ui/input.tsx',
    'components/ui/select.tsx',
    'components/ui/kpi-card.tsx',
    'components/ui/stat-card.tsx',
    'components/ui/page-header.tsx',
    'components/ui/empty-state.tsx',
    'components/ui/modal.tsx',
    'components/ui/drawer.tsx',
    'components/ui/tabs.tsx',
    'components/ui/forbidden.tsx',
    'components/ui/skeleton.tsx',
    'components/ui/breadcrumbs.tsx',
    'components/layout/app-shell.tsx',
    'components/layout/command-palette.tsx',
    'components/layout/theme-switcher.tsx',
    'components/layout/support-session-banner.tsx',
    'components/guards/ExperienceGuard.tsx',
    'components/brand/brand-mark.tsx',
    // The root <html dir="rtl"> must never be stripped.
    'app/layout.tsx',
  ].map((p) => p.replaceAll('/', path.sep)),
);

// ---------------------------------------------------------------------------
// Color families
// ---------------------------------------------------------------------------
const FAMILY = {
  emerald: 'primary',
  teal: 'primary',
  cyan: 'info',
  green: 'success',
  lime: 'success',
  red: 'danger',
  rose: 'danger',
  amber: 'warning',
  yellow: 'warning',
  orange: 'warning',
  sky: 'info',
  blue: 'info',
  indigo: 'info',
  purple: 'accent',
  violet: 'accent',
  fuchsia: 'accent',
  pink: 'accent',
};
const NEUTRAL = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone']);
const COLOR_RE =
  /^((?:[a-z-]+:)*)(text|bg|border|border-[trblxyse]|ring|ring-offset|from|to|via|divide|placeholder|fill|stroke|shadow|outline|decoration|accent|caret)-(emerald|teal|cyan|green|lime|red|rose|amber|yellow|orange|sky|blue|indigo|purple|violet|fuchsia|pink|slate|gray|zinc|neutral|stone)-(\d{2,3})(\/\d{1,3})?$/;

function semanticColor(prop, family, shade, opacity = '') {
  const s = Number(shade);
  if (NEUTRAL.has(family)) {
    switch (prop) {
      case 'text':
        if (s <= 300) return 'text-fg';
        if (s <= 500) return 'text-fg-muted';
        if (s <= 600) return 'text-fg-subtle';
        return 'text-fg';
      case 'bg':
        if (s <= 100) return `bg-surface-muted${opacity}`;
        if (s <= 400) return `bg-border${opacity}`;
        if (s <= 800) return `bg-surface-muted${opacity}`;
        return `bg-surface-sunken${opacity}`;
      case 'placeholder':
        return 'placeholder-fg-subtle';
      case 'divide':
        return 'divide-border';
      case 'ring':
      case 'ring-offset':
        return `${prop}-border`;
      case 'from':
      case 'to':
      case 'via':
        return `${prop}-surface-muted${opacity}`;
      case 'shadow':
        return `shadow-fg/10`;
      default:
        // border*, outline, fill, stroke…
        return s >= 500 && prop.startsWith('border') ? `${prop}-border-strong${opacity}` : `${prop}-border${opacity}`;
    }
  }
  const sem = FAMILY[family];
  switch (prop) {
    case 'text':
      return `text-${sem}`;
    case 'bg':
      if (s <= 100) return `bg-${sem}-subtle`;
      if (s >= 800) return opacity ? `bg-${sem}${opacity}` : `bg-${sem}-subtle`;
      return `bg-${sem}${opacity}`;
    case 'placeholder':
      return 'placeholder-fg-subtle';
    default:
      if (prop.startsWith('border') && !opacity && s <= 300) return `${prop}-${sem}/30`;
      return `${prop}-${sem}${opacity}`;
  }
}

// Foreground to use on a solid semantic background.
function fgFor(classes) {
  const solid = classes.find((c) =>
    /^(?:[a-z-]+:)*bg-(primary|danger|success|warning|info|accent|destructive|turquoise)(?:\/(?:[6-9]\d|100))?$/.test(c),
  );
  if (solid) {
    const fam = solid.replace(/^(?:[a-z-]+:)*bg-/, '').replace(/\/.*/, '');
    const name = fam === 'destructive' ? 'danger' : fam === 'turquoise' ? 'primary' : fam;
    return `text-${name}-fg`;
  }
  if (classes.some((c) => /^(?:[a-z-]+:)*(bg-gradient|from-|bg-black|bg-surface-brand)/.test(c))) return 'text-white';
  return null;
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------
const FONT_PX = { 9: 'text-xs', 10: 'text-xs', 11: 'text-xs', 12: 'text-xs', 13: 'text-sm', 14: 'text-sm', 15: 'text-base', 16: 'text-base', 17: 'text-lg', 18: 'text-lg', 20: 'text-xl', 22: 'text-xl', 24: 'text-2xl', 26: 'text-2xl', 28: 'text-2xl', 30: 'text-3xl', 32: 'text-3xl', 36: 'text-3xl' };
function radiusForPx(px) {
  if (px <= 4) return 'rounded-xs';
  if (px <= 7) return 'rounded-xs';
  if (px <= 9) return 'rounded-sm';
  if (px <= 13) return 'rounded-md';
  if (px <= 17) return 'rounded-lg';
  if (px <= 22) return 'rounded-xl';
  return 'rounded-2xl';
}
// Tailwind defaults (pre-R7 meaning) → new scale with the same pixel size.
const OLD_RADIUS = { rounded: 'rounded-xs', 'rounded-sm': 'rounded-xs', 'rounded-md': 'rounded-xs', 'rounded-lg': 'rounded-sm', 'rounded-xl': 'rounded-md', 'rounded-2xl': 'rounded-lg', 'rounded-3xl': 'rounded-xl' };

// Physical → logical, authored for RTL: right == inline-start, left == inline-end.
const LOGICAL = [
  [/^(-?)mr-/, '$1ms-'],
  [/^(-?)ml-/, '$1me-'],
  [/^pr-/, 'ps-'],
  [/^pl-/, 'pe-'],
  [/^(-?)right-/, '$1start-'],
  [/^(-?)left-/, '$1end-'],
  [/^border-r-/, 'border-s-'],
  [/^border-l-/, 'border-e-'],
  [/^border-r$/, 'border-s'],
  [/^border-l$/, 'border-e'],
  [/^rounded-r-/, 'rounded-s-'],
  [/^rounded-l-/, 'rounded-e-'],
  [/^rounded-tr-/, 'rounded-ss-'],
  [/^rounded-tl-/, 'rounded-se-'],
  [/^rounded-br-/, 'rounded-es-'],
  [/^rounded-bl-/, 'rounded-ee-'],
  [/^text-right$/, 'text-start'],
  [/^text-left$/, 'text-end'],
];

// ---------------------------------------------------------------------------
const CLASS_TOKEN = /^!?(?:[a-z0-9@\[\]&>*_=().,'-]+:)*-?[a-z0-9\[][\w\[\]\/.%#(),:'-]*$/;

function mapToken(tok, ctx) {
  const m = tok.match(/^((?:[a-z0-9@\[\]&>*_=().,'-]+:)*)(.*)$/);
  const variant = m[1];
  const core = m[2];

  // raw palette colors
  const cm = core.match(COLOR_RE);
  if (cm) return `${variant}${semanticColor(cm[2], cm[3], cm[4], cm[5] || '')}`;
  if (/^bg-white\/\d+$/.test(core)) return `${variant}bg-fg/${core.split('/')[1]}`;
  if (core === 'bg-white') return `${variant}bg-surface`;
  if (/^border-white(\/\d+)?$/.test(core)) return `${variant}border-border`;
  if (/^text-black(\/\d+)?$/.test(core)) return `${variant}text-fg`;

  // arbitrary font sizes
  const fs_ = core.match(/^text-\[(\d+)px\]$/);
  if (fs_ && FONT_PX[fs_[1]]) return `${variant}${FONT_PX[fs_[1]]}`;
  // arbitrary radii
  const rr = core.match(/^rounded(-[a-z]{1,2})?-\[(\d+)px\]$/);
  if (rr) return `${variant}${radiusForPx(Number(rr[2])).replace('rounded', `rounded${rr[1] ?? ''}`)}`;
  // old radius names
  if (OLD_RADIUS[core]) return `${variant}${OLD_RADIUS[core]}`;
  if (core === 'shadow-2xl') return `${variant}shadow-xl`;

  // logical properties
  if (core === 'space-x-reverse') return '';
  if (/^space-x-\d/.test(core) && ctx.isFlex) return `${variant}${core.replace('space-x-', 'gap-x-')}`;
  if (!ctx.hasTranslateX) {
    for (const [re, rep] of LOGICAL) if (re.test(core)) return `${variant}${core.replace(re, rep)}`;
  }
  return tok;
}

function mapWhite(tok, fg) {
  const m = tok.match(/^((?:[a-z0-9@\[\]&>*_=().,'-]+:)*)(text-white(?:\/(\d+))?)$/);
  if (!m) return tok;
  const [, variant, , op] = m;
  if (fg) return `${variant}${fg}${op ? `/${op}` : ''}`;
  if (variant && /hover:|focus:|active:/.test(variant)) return `${variant}text-fg`;
  if (!op || Number(op) >= 90) return `${variant}text-fg`;
  if (Number(op) >= 60) return `${variant}text-fg-muted`;
  return `${variant}text-fg-subtle`;
}

function transformClassList(str) {
  const parts = str.split(/(\s+)/);
  const tokens = parts.filter((p) => p.trim());
  if (!tokens.length || !tokens.every((t) => CLASS_TOKEN.test(t))) return str;
  if (!tokens.some((t) => /^(?:[^:]+:)*-?(text|bg|border|rounded|ring|from|to|via|shadow|space|divide|placeholder|m[lr]|p[lr]|left|right|ml|mr|pl|pr)(-|$)/.test(t))) return str;
  const ctx = {
    hasTranslateX: tokens.some((t) => /translate-x/.test(t)),
    isFlex: tokens.some((t) => /^(inline-)?flex$/.test(t)),
  };
  // Pass 1: colors/scales/logical. Pass 2: text-white from the (now semantic) background.
  const mapped = parts.map((p) => (p.trim() ? mapToken(p, ctx) : p));
  const fg = fgFor(mapped.filter((p) => p.trim()));
  return mapped
    .map((p) => (p.trim() ? mapWhite(p, fg) : p))
    .join('')
    .replace(/[ 	]{2,}/g, ' ');
}

// String-ish literals: "…", '…', `…` (template parts between ${…} are handled as one string).
const LITERAL_RE = /(["'`])((?:\\.|(?!\1)[^\\\n])*?)\1/g;

function transformFile(src) {
  return src
    .replace(LITERAL_RE, (whole, q, body) => {
      if (q === '`') {
        // Transform the static chunks of a template literal, keep ${…} intact.
        const out = body.replace(/(^|\})([^$`]*?)(\$\{|$)/g, (_m, a, chunk, b) => a + transformClassList(chunk) + b);
        return q + out + q;
      }
      return q + transformClassList(body) + q;
    })
    .replace(/\s+dir="rtl"/g, '');
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const files = (targets.length ? targets.map((t) => path.resolve(t)) : ['app', 'features', 'components'].map((d) => path.join(SRC, d)))
  .flatMap((t) => (fs.statSync(t).isDirectory() ? walk(t) : [t]))
  .filter((f) => !KEEP.has(path.relative(SRC, f)) && !f.includes(`${path.sep}icons${path.sep}`));

let changed = 0;
for (const f of files) {
  const before = fs.readFileSync(f, 'utf8');
  const after = transformFile(before);
  if (after !== before) {
    changed++;
    if (!DRY) fs.writeFileSync(f, after);
  }
}
console.log(`${DRY ? '[dry] ' : ''}${changed}/${files.length} files changed`);

// R7 design codemod — replaces emoji / Unicode "icons" with Lucide SVG icons (plan §6.2, §7).
//
//   node scripts/design-codemods/codemod-symbols.mjs [--dry]
//
// Context-aware (TypeScript AST):
//   • JSX text           → the symbol becomes an inline <Icon/> element
//   • icon="…" props     → icon={<Icon/>}
//   • string literal that is a JSX child (incl. inside ?:/&&) → JSX element / fragment
//   • any other string (titles, template strings, option labels) → symbol removed
// Arrows are semantic: text mentioning back/previous gets <IconBack/>, otherwise <IconNext/>.
// Purely decorative emoji (wave, party, gift) are removed instead of replaced.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SRC = path.resolve(import.meta.dirname, '../../src');
const DRY = process.argv.includes('--dry');

/** symbol → Lucide component (null = decorative, remove). Longest sequences first. */
const MAP = [
  ['👨‍👩‍👦', 'Users'],
  ['👨‍👧‍👦', 'Users'],
  ['👨‍👧', 'Users'],
  ['👨‍🏫', 'Presentation'],
  ['🎓', 'GraduationCap'],
  ['➕', 'Plus'],
  ['✏', 'Pencil'],
  ['🗑', 'Trash2'],
  ['✕', 'X'],
  ['✖', 'X'],
  ['✗', 'X'],
  ['❌', 'CircleX'],
  ['⚠', 'TriangleAlert'],
  ['✅', 'CircleCheck'],
  ['✓', 'Check'],
  ['✔', 'Check'],
  ['📄', 'FileText'],
  ['📑', 'FileText'],
  ['⬇', 'Download'],
  ['📤', 'Upload'],
  ['📥', 'Import'],
  ['🔑', 'KeyRound'],
  ['🔄', 'RefreshCw'],
  ['🏠', 'Home'],
  ['⚡', 'Zap'],
  ['🛡', 'ShieldCheck'],
  ['📅', 'CalendarDays'],
  ['📚', 'BookOpen'],
  ['🔗', 'Link'],
  ['👥', 'Users'],
  ['✋', 'Hand'],
  ['🎙', 'Mic'],
  ['🔇', 'MicOff'],
  ['📹', 'Video'],
  ['🎥', 'Video'],
  ['📷', 'VideoOff'],
  ['⭐', 'Star'],
  ['🔦', 'Flashlight'],
  ['📝', 'NotebookPen'],
  ['📁', 'Folder'],
  ['▶', 'Play'],
  ['💡', 'Lightbulb'],
  ['📋', 'Copy'],
  ['🔍', 'Search'],
  ['📭', 'Inbox'],
  ['🔒', 'Lock'],
  ['ℹ', 'Info'],
  ['📱', 'Smartphone'],
  ['🚫', 'Ban'],
  ['📦', 'Package'],
  ['💰', 'Banknote'],
  ['⏳', 'Hourglass'],
  ['💳', 'CreditCard'],
  ['⚙', 'Loader2'],
  ['📊', 'ChartColumn'],
  ['🖨', 'Printer'],
  ['🏫', 'School'],
  ['▼', 'ChevronDown'],
  ['▲', 'ChevronUp'],
  ['⇅', 'ArrowUpDown'],
  ['🎉', 'PartyPopper'],
  ['🎁', null],
  ['👋', null],
  ['↗', '@IconExternal'],
  ['←', '@ARROW'],
  ['→', '@ARROW'],
  ['↵', null],
  ['↑', 'ArrowUp'],
  ['↓', 'ArrowDown'],
];
const VS16 = /️/g;
const SYMBOL_RE = new RegExp(MAP.map(([s]) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');
const BACK_WORDS = /العودة|عودة|رجوع|السابق|السابقة|back|previous/i;

function iconFor(symbol, context) {
  const entry = MAP.find(([s]) => s === symbol);
  if (!entry) return undefined;
  let name = entry[1];
  if (name === '@ARROW') name = BACK_WORDS.test(context) ? '@IconBack' : '@IconNext';
  return name;
}

function sizeFor(node, sf) {
  // Look at the nearest JSX element's className for a size hint.
  let n = node;
  while (n && !ts.isJsxElement(n)) n = n.parent;
  const open = n?.openingElement;
  const cls = open?.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'className');
  const text = cls ? cls.getText(sf) : '';
  if (/text-(4xl|5xl|3xl)/.test(text)) return 32;
  if (/text-(2xl|xl)/.test(text)) return 24;
  if (/text-(lg|base)/.test(text)) return 18;
  return 16;
}

function jsxIcon(name, size, used) {
  if (name.startsWith('@')) {
    const comp = name.slice(1);
    used.directional.add(comp);
    return `<${comp} size={${size}} />`;
  }
  used.lucide.add(name);
  const spin = name === 'Loader2' ? ' className="animate-spin"' : '';
  return `<${name} size={${size}} strokeWidth={1.75}${spin} aria-hidden />`;
}

function stripSymbols(text) {
  return text.replace(VS16, '').replace(SYMBOL_RE, '').replace(/\s{2,}/g, ' ').replace(/^\s+(?=\S)|(?<=\S)\s+$/g, (m) => (m.includes('\n') ? m : ' '));
}

/** Is this string literal rendered as a JSX child (possibly via ?:, &&, ||, parens)? */
function isJsxChildExpression(node) {
  let n = node;
  while (n.parent && (ts.isConditionalExpression(n.parent) || ts.isBinaryExpression(n.parent) || ts.isParenthesizedExpression(n.parent))) {
    if (ts.isConditionalExpression(n.parent) && n.parent.condition === n) return false;
    if (ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken) return false;
    n = n.parent;
  }
  return ts.isJsxExpression(n.parent) && !ts.isJsxAttribute(n.parent.parent);
}

/** Converts mixed text ("🔑 كلمة المرور") to JSX children, symbols as icons. */
function textToJsx(raw, node, sf, used, { decorativeTrailing = true } = {}) {
  const text = raw.replace(VS16, '');
  const words = text.replace(SYMBOL_RE, '').trim();
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(SYMBOL_RE)) {
    parts.push({ t: 'text', v: text.slice(last, m.index) });
    parts.push({ t: 'sym', v: m[0], index: m.index });
    last = m.index + m[0].length;
  }
  parts.push({ t: 'text', v: text.slice(last) });
  const size = sizeFor(node, sf);
  return parts
    .map((p) => {
      if (p.t === 'text') return p.v;
      const name = iconFor(p.v, words);
      const atEnd = text.slice(p.index + p.v.length).trim() === '';
      if (name === null || (decorativeTrailing && words && atEnd && ['🎉', '🎁'].includes(p.v))) return '';
      return jsxIcon(name, size, used);
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ');
}

function relImport(file, target) {
  let rel = path.relative(path.dirname(file), target).replaceAll('\\', '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function transform(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (!SYMBOL_RE.test(src.replace(VS16, ''))) return null;
  SYMBOL_RE.lastIndex = 0;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const used = { lucide: new Set(), directional: new Set() };
  const has = (t) => {
    SYMBOL_RE.lastIndex = 0;
    return SYMBOL_RE.test(t.replace(VS16, ''));
  };

  function visit(node) {
    if (ts.isJsxText(node) && has(node.text)) {
      edits.push([node.getStart(sf), node.getEnd(), textToJsx(node.getFullText(sf), node, sf, used)]);
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && has(node.initializer.text)) {
      const attr = node.name.getText(sf);
      const value = node.initializer.text.replace(VS16, '').trim();
      const sym = value.match(SYMBOL_RE)?.[0];
      if (attr === 'icon' && sym && value === sym) {
        const name = iconFor(sym, '') ?? 'Circle';
        edits.push([node.initializer.getStart(sf), node.initializer.getEnd(), `{${jsxIcon(name, 20, used)}}`]);
      } else {
        edits.push([node.initializer.getStart(sf), node.initializer.getEnd(), JSON.stringify(stripSymbols(node.initializer.text).trim())]);
      }
      return;
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && has(node.text)) {
      if (isJsxChildExpression(node)) {
        const jsx = textToJsx(node.text, node, sf, used);
        const onlyIcon = /^<[^<>]+\/>$/.test(jsx.trim());
        edits.push([node.getStart(sf), node.getEnd(), onlyIcon ? jsx.trim() : `<>${jsx}</>`]);
      } else {
        const q = ts.isStringLiteral(node) ? src[node.getStart(sf)] : '`';
        const body = stripSymbols(node.text).trim();
        edits.push([node.getStart(sf), node.getEnd(), q === '`' ? `\`${body}\`` : `${q}${body.replaceAll(q, `\\${q}`)}${q}`]);
      }
      return;
    }
    if ((ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && has(node.text)) {
      const raw = node.getText(sf);
      edits.push([node.getStart(sf), node.getEnd(), raw.replace(VS16, '').replace(SYMBOL_RE, '').replace(/ {2,}/g, ' ').replace(/ (`|\$\{)/, '$1')]);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (!edits.length) return null;

  let out = src;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + text + out.slice(end);

  // Imports
  const importLines = [];
  if (used.lucide.size) {
    const existing = out.match(/import \{([^}]*)\} from 'lucide-react';/);
    if (existing) {
      const names = new Set(existing[1].split(',').map((s) => s.trim()).filter(Boolean));
      used.lucide.forEach((n) => names.add(n));
      out = out.replace(existing[0], `import { ${[...names].sort().join(', ')} } from 'lucide-react';`);
    } else {
      importLines.push(`import { ${[...used.lucide].sort().join(', ')} } from 'lucide-react';`);
    }
  }
  if (used.directional.size) {
    importLines.push(
      `import { ${[...used.directional].sort().join(', ')} } from '${relImport(file, path.join(SRC, 'components/icons/directional'))}';`,
    );
  }
  if (importLines.length) {
    const lastImport = [...out.matchAll(/^import [\s\S]*?from ['"][^'"]+['"];?\s*$/gm)].pop();
    const at = lastImport ? lastImport.index + lastImport[0].length : (out.match(/^['"]use client['"];?\s*$/m)?.index ?? -1) + 1;
    out = out.slice(0, at) + '\n' + importLines.join('\n') + out.slice(at);
  }
  return { out, count: edits.length };
}

let files = 0;
let total = 0;
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (!p.endsWith(`${path.sep}icons`)) walk(p);
    } else if (/\.tsx?$/.test(name)) {
      const r = transform(p);
      if (r) {
        files++;
        total += r.count;
        if (!DRY) fs.writeFileSync(p, r.out);
      }
    }
  }
})(SRC);
console.log(`${DRY ? '[dry] ' : ''}${total} replacements in ${files} files`);

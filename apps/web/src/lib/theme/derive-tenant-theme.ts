/**
 * TL-2 (ADR-007): Pure OKLCH-based tenant theme derivation.
 *
 * Input:  4 owner-chosen hex colors (primary, secondary, accent, surface)
 * Output: CSS custom-property overrides for [data-tenant-theme] and
 *         [data-tenant-theme][data-theme="dark"]
 *
 * No DOM, no external packages — runs in Server Components, Vitest, and the
 * editor's live preview. The 4 inputs are always validated hex #RRGGBB before
 * this function is called; `isValidPalette` is exported for callers.
 *
 * WCAG AA enforcement: every foreground/background pair is nudged until contrast
 * ≥ 4.5. After 20 steps the platform default (#1A1A1A or #FFFFFF) is used and
 * a warning is emitted in `deriveTenantTheme.warnings`.
 */

// ─── Oklab / OKLCH math ────────────────────────────────────────────────────
// Source: https://bottosson.github.io/posts/oklab/

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function gamma(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(1, v));
}

function hexToLinearRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    linearize(parseInt(h.slice(0, 2), 16) / 255),
    linearize(parseInt(h.slice(2, 4), 16) / 255),
    linearize(parseInt(h.slice(4, 6), 16) / 255),
  ];
}

function linearRgbToHex(r: number, g: number, b: number): string {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(gamma(v) * 255)));
  return `#${ch(r).toString(16).padStart(2, '0')}${ch(g).toString(16).padStart(2, '0')}${ch(b).toString(16).padStart(2, '0')}`;
}

type Oklch = { l: number; c: number; h: number };

function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToLinearRgb(hex);
  const lms_l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const lms_m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const lms_s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(lms_l);
  const m_ = Math.cbrt(lms_m);
  const s_ = Math.cbrt(lms_s);
  const L =  0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a =  1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C  = Math.sqrt(a * a + bk * bk);
  const H  = ((Math.atan2(bk, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c: C, h: H };
}

function oklchToHex({ l, c, h }: Oklch): string {
  const hRad = (h * Math.PI) / 180;
  const a    = c * Math.cos(hRad);
  const bk   = c * Math.sin(hRad);
  const l_   = l  + 0.3963377774 * a + 0.2158037573 * bk;
  const m_   = l  - 0.1055613458 * a - 0.0638541728 * bk;
  const s_   = l  - 0.0894841775 * a - 1.2914855480 * bk;
  const lc   = l_ ** 3;
  const mc   = m_ ** 3;
  const sc   = s_ ** 3;
  return linearRgbToHex(
    +4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc,
  );
}

// ─── WCAG contrast helpers ─────────────────────────────────────────────────

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** White or black — whichever achieves AA against `bgHex`. */
function binaryFg(bgHex: string): string {
  return contrastRatio('#000000', bgHex) >= contrastRatio('#FFFFFF', bgHex) ? '#000000' : '#FFFFFF';
}

/**
 * Walk L toward the dark or light end until contrast ≥ threshold.
 * Returns `fallback` if still below after 20 steps.
 */
function enforceAA(
  textOklch: Oklch,
  bgHex: string,
  threshold: number,
  fallback: string,
  warnings: string[],
  label: string,
): string {
  const bgLum = relativeLuminance(bgHex);
  const needDarker = bgLum > 0.179; // text goes darker on light backgrounds
  let { l, c, h } = textOklch;
  for (let i = 0; i < 20; i++) {
    const hex = oklchToHex({ l, c, h });
    if (contrastRatio(hex, bgHex) >= threshold) return hex;
    l = needDarker ? Math.max(0, l - 0.03) : Math.min(1, l + 0.03);
  }
  warnings.push(`${label}: contrast unachievable — using platform default`);
  return fallback;
}

// ─── Token builders ────────────────────────────────────────────────────────

/** Derives {--prefix}, {--prefix-hover}, {--prefix-fg}, {--prefix-subtle}, {--prefix-subtle-fg}, {--prefix-ring}. */
function colorTokens(
  hex: string,
  prefix: string,
  darkMode: boolean,
  warnings: string[],
): Record<string, string> {
  const ok = hexToOklch(hex);
  // In dark mode, lift lightness so the colour reads on dark surfaces
  const liftedL = darkMode ? Math.min(0.90, ok.l + 0.12) : ok.l;
  const lifted  = darkMode ? oklchToHex({ ...ok, l: liftedL }) : hex;
  const liftedOk: Oklch = { ...ok, l: liftedL };

  // Subtle bg: very high lightness (light mode) or very low (dark mode), low chroma
  const subtleBg = darkMode
    ? oklchToHex({ l: 0.18, c: ok.c * 0.28, h: ok.h })
    : oklchToHex({ l: 0.96, c: ok.c * 0.22, h: ok.h });

  const subtleFgSeed: Oklch = darkMode
    ? { l: 0.80, c: ok.c * 0.5, h: ok.h }
    : { l: 0.26, c: ok.c * 0.5, h: ok.h };

  return {
    [`--${prefix}`]:            lifted,
    [`--${prefix}-hover`]:      oklchToHex({ ...liftedOk, l: darkMode ? Math.min(1, liftedL + 0.07) : Math.max(0.05, liftedL - 0.07) }),
    [`--${prefix}-fg`]:         binaryFg(lifted),
    [`--${prefix}-subtle`]:     subtleBg,
    [`--${prefix}-subtle-fg`]:  enforceAA(subtleFgSeed, subtleBg, 4.5, darkMode ? '#E0E0E0' : '#1A1A1A', warnings, `${prefix}-subtle-fg`),
    [`--${prefix}-ring`]:       `color-mix(in oklch, ${lifted} 40%, transparent)`,
  };
}

/** Derives surface/border/fg tokens from the owner's surface colour. */
function surfaceTokens(surfaceHex: string, darkMode: boolean, warnings: string[]): Record<string, string> {
  const ok  = hexToOklch(surfaceHex);
  const h   = ok.h;
  const c   = Math.min(ok.c, 0.025); // cap chroma — keep warmth, stay neutral

  if (!darkMode) {
    // Light mode: surface is used as-is; floor at L=0.88 so it's always light
    const L = Math.max(0.88, ok.l);
    const bg = oklchToHex({ l: L, c, h });
    const tokens: Record<string, string> = {
      '--surface':         bg,
      '--surface-raised':  bg,
      '--surface-sunken':  oklchToHex({ l: Math.max(0, L - 0.04), c, h }),
      '--surface-muted':   oklchToHex({ l: Math.max(0, L - 0.08), c, h }),
      '--surface-overlay': 'rgba(0,0,0,0.42)',
      '--border-subtle':   oklchToHex({ l: Math.max(0, L - 0.09), c, h }),
      '--border':          oklchToHex({ l: Math.max(0, L - 0.14), c, h }),
      '--border-strong':   oklchToHex({ l: Math.max(0, L - 0.22), c, h }),
      '--fg-inverse':      '#1A1A1A',
    };
    tokens['--fg']       = enforceAA({ l: 0.13, c, h }, bg, 7.0, '#1A1A1A', warnings, 'fg');
    tokens['--fg-muted'] = enforceAA({ l: 0.40, c, h }, bg, 4.5, '#555555', warnings, 'fg-muted');
    tokens['--fg-subtle']= enforceAA({ l: 0.54, c, h }, bg, 3.0, '#777777', warnings, 'fg-subtle');
    return tokens;
  } else {
    // Dark mode: invert — dark surface derived from same hue, very low L
    const L = Math.min(0.20, 1 - ok.l + 0.02);
    const bg = oklchToHex({ l: L, c, h });
    const tokens: Record<string, string> = {
      '--surface':         bg,
      '--surface-raised':  oklchToHex({ l: Math.min(1, L + 0.04), c, h }),
      '--surface-sunken':  oklchToHex({ l: Math.max(0, L - 0.04), c, h }),
      '--surface-muted':   oklchToHex({ l: Math.min(1, L + 0.07), c, h }),
      '--surface-overlay': 'rgba(0,0,0,0.60)',
      '--border-subtle':   oklchToHex({ l: Math.min(1, L + 0.09), c, h }),
      '--border':          oklchToHex({ l: Math.min(1, L + 0.14), c, h }),
      '--border-strong':   oklchToHex({ l: Math.min(1, L + 0.22), c, h }),
      '--fg-inverse':      '#F0F0F0',
    };
    tokens['--fg']       = enforceAA({ l: 0.94, c, h }, bg, 7.0, '#F8F8F8', warnings, 'fg-dark');
    tokens['--fg-muted'] = enforceAA({ l: 0.74, c, h }, bg, 4.5, '#BBBBBB', warnings, 'fg-muted-dark');
    tokens['--fg-subtle']= enforceAA({ l: 0.59, c, h }, bg, 3.0, '#909090', warnings, 'fg-subtle-dark');
    return tokens;
  }
}

function gradientBrand(primary: string, secondary: string): string {
  const ok    = hexToOklch(primary);
  const dark  = oklchToHex({ ...ok, l: Math.max(0.05, ok.l - 0.12) });
  const light = oklchToHex({ ...ok, l: Math.min(0.95, ok.l + 0.08), c: ok.c * 0.9 });
  return `linear-gradient(135deg, ${dark} 0%, ${primary} 55%, ${light} 100%)`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface TenantPalette {
  primary:   string;
  secondary: string;
  accent:    string;
  surface:   string;
}

/** Returns true iff all four keys are valid #RRGGBB hex strings. */
export function isValidPalette(p: unknown): p is TenantPalette {
  if (!p || typeof p !== 'object') return false;
  const { primary, secondary, accent, surface } = p as Record<string, unknown>;
  const hex = /^#[0-9a-fA-F]{6}$/;
  return [primary, secondary, accent, surface].every((v) => typeof v === 'string' && hex.test(v));
}

export interface DeriveResult {
  /** Raw CSS to inject as <style id="tenant-theme">. Empty string when palette is invalid. */
  css: string;
  /** AA enforcement warnings; non-empty means some token fell back to a platform default. */
  warnings: string[];
}

/**
 * Derive CSS variable overrides for one tenant.
 * Inject the returned `css` as `<style id="tenant-theme">` before the tenant layout.
 */
export function deriveTenantTheme(palette: TenantPalette): DeriveResult {
  if (!isValidPalette(palette)) return { css: '', warnings: ['invalid palette — skipped'] };

  const warnings: string[] = [];
  const primary   = palette.primary.toLowerCase();
  const secondary = palette.secondary.toLowerCase();
  const accent    = palette.accent.toLowerCase();

  const light: Record<string, string> = {
    ...colorTokens(primary, 'primary', false, warnings),
    ...colorTokens(accent,  'accent',  false, warnings),
    ...surfaceTokens(palette.surface, false, warnings),
    '--gradient-brand': gradientBrand(primary, secondary),
  };

  const dark: Record<string, string> = {
    ...colorTokens(primary, 'primary', true, warnings),
    ...colorTokens(accent,  'accent',  true, warnings),
    ...surfaceTokens(palette.surface, true, warnings),
    '--gradient-brand': gradientBrand(
      oklchToHex({ ...hexToOklch(primary), l: Math.min(0.90, hexToOklch(primary).l + 0.12) }),
      oklchToHex({ ...hexToOklch(secondary), l: Math.min(0.90, hexToOklch(secondary).l + 0.12) }),
    ),
  };

  const block = (sel: string, tokens: Record<string, string>) =>
    `${sel} {\n${Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;

  const css = [
    block('[data-tenant-theme]', light),
    block('[data-tenant-theme][data-theme="dark"]', dark),
  ].join('\n');

  return { css, warnings };
}

/** Platform default palette (emerald + sand). Used when an academy has no published settings. */
export const DEFAULT_PALETTE: TenantPalette = {
  primary:   '#0C7F6D',
  secondary: '#0B6659',
  accent:    '#7D532E',
  surface:   '#FFFFFF',
};

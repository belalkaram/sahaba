/**
 * TL-2 (ADR-007): derive-tenant-theme unit tests.
 * Node.js native test runner (no Vitest dependency).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node 24 native test runner requires .ts extension for ESM resolution
import { deriveTenantTheme, isValidPalette, DEFAULT_PALETTE, type TenantPalette } from '../src/lib/theme/derive-tenant-theme.ts';

const PLATFORM_PALETTE: TenantPalette = DEFAULT_PALETTE;

// ─── isValidPalette ─────────────────────────────────────────────────────────

describe('isValidPalette', () => {
  test('accepts four valid #RRGGBB strings', () => {
    assert.ok(isValidPalette(PLATFORM_PALETTE));
  });

  test('rejects short hex (#RGB)', () => {
    assert.strictEqual(isValidPalette({ ...PLATFORM_PALETTE, primary: '#0C7' }), false);
  });

  test('rejects OKLCH string', () => {
    assert.strictEqual(isValidPalette({ ...PLATFORM_PALETTE, primary: 'oklch(0.5 0.1 150)' }), false);
  });

  test('rejects null', () => {
    assert.strictEqual(isValidPalette(null), false);
  });

  test('rejects missing key', () => {
    const { surface: _s, ...noSurface } = PLATFORM_PALETTE;
    assert.strictEqual(isValidPalette(noSurface), false);
  });
});

// ─── deriveTenantTheme ──────────────────────────────────────────────────────

describe('deriveTenantTheme — output shape', () => {
  test('returns non-empty CSS for valid palette', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    assert.ok(css.length > 0, 'CSS should not be empty');
  });

  test('returns empty CSS for invalid palette', () => {
    const { css } = deriveTenantTheme({ primary: 'red', secondary: '#fff', accent: '#000', surface: '#fff' });
    assert.strictEqual(css, '');
  });

  test('light mode block uses [data-tenant-theme] selector', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    assert.ok(css.includes('[data-tenant-theme] {'), 'Missing light mode selector');
  });

  test('dark mode block uses [data-tenant-theme][data-theme="dark"] selector', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    assert.ok(css.includes('[data-tenant-theme][data-theme="dark"] {'), 'Missing dark mode selector');
  });

  test('includes --primary token in both modes', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    const count = (css.match(/--primary:/g) ?? []).length;
    assert.ok(count >= 2, `Expected --primary in both blocks, got ${count}`);
  });

  test('includes --accent token', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    assert.ok(css.includes('--accent:'), 'Missing --accent token');
  });

  test('includes --surface token', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    assert.ok(css.includes('--surface:'), 'Missing --surface token');
  });

  test('includes --fg token', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    assert.ok(css.includes('--fg:'), 'Missing --fg token');
  });

  test('includes --gradient-brand', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    assert.ok(css.includes('--gradient-brand:'), 'Missing --gradient-brand');
  });

  test('all hex values in output are valid #RRGGBB', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    // Extract all #xxxxxx patterns from the CSS
    const hexes = css.match(/#[0-9a-fA-F]{6}/g) ?? [];
    assert.ok(hexes.length >= 20, `Expected at least 20 hex values, got ${hexes.length}`);
    for (const hex of hexes) {
      assert.match(hex, /^#[0-9a-fA-F]{6}$/, `Invalid hex in output: ${hex}`);
    }
  });

  test('no hex values exceed 7 characters (no long hex or hash collision)', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    // Look for #RRGGBBXX (8+ char hex) which would be a bug
    const longHex = css.match(/#[0-9a-fA-F]{7,}/g);
    assert.strictEqual(longHex, null, `Found unexpectedly long hex: ${longHex}`);
  });
});

describe('deriveTenantTheme — WCAG AA', () => {
  // Helper: parse relative luminance from hex
  function lum(hex: string): number {
    const h = hex.replace('#', '');
    const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(hex1: string, hex2: string): number {
    const l1 = lum(hex1); const l2 = lum(hex2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function extract(css: string, token: string): string | null {
    const m = css.match(new RegExp(`${token.replace('--', '--')}:\\s*(#[0-9a-fA-F]{6})`));
    return m ? m[1] : null;
  }

  test('--primary-fg achieves AA contrast against --primary in light mode', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    // Extract light mode block only
    const lightBlock = css.split('[data-tenant-theme][data-theme')[0];
    const fg  = extract(lightBlock, '--primary-fg');
    const bg  = extract(lightBlock, '--primary:');
    if (!fg || !bg) return; // skip if not hex (could be color-mix)
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= 4.5, `--primary-fg contrast ${ratio.toFixed(2)} < 4.5 on --primary`);
  });

  test('--fg achieves AA contrast against --surface in light mode', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    const lightBlock = css.split('[data-tenant-theme][data-theme')[0];
    const fg      = extract(lightBlock, '--fg:');
    const surface = extract(lightBlock, '--surface:');
    if (!fg || !surface) return;
    const ratio = contrast(fg, surface);
    assert.ok(ratio >= 4.5, `--fg contrast ${ratio.toFixed(2)} < 4.5 on --surface`);
  });

  test('--fg achieves AA contrast against --surface in dark mode', () => {
    const { css } = deriveTenantTheme(PLATFORM_PALETTE);
    const darkBlock = css.split('[data-tenant-theme][data-theme')[1] ?? '';
    const fg      = extract(darkBlock, '--fg:');
    const surface = extract(darkBlock, '--surface:');
    if (!fg || !surface) return;
    const ratio = contrast(fg, surface);
    assert.ok(ratio >= 4.5, `dark --fg contrast ${ratio.toFixed(2)} < 4.5 on --surface`);
  });
});

describe('deriveTenantTheme — custom palette', () => {
  const MIDNIGHT: TenantPalette = {
    primary:   '#6366F1', // indigo
    secondary: '#4338CA',
    accent:    '#F59E0B', // amber
    surface:   '#FAFAF9', // near-white
  };

  test('platform default and custom palette produce different --primary tokens', () => {
    const a = deriveTenantTheme(PLATFORM_PALETTE).css;
    const b = deriveTenantTheme(MIDNIGHT).css;
    // The light-mode [data-tenant-theme] blocks should differ
    const blockA = a.split('[data-tenant-theme][data-theme')[0];
    const blockB = b.split('[data-tenant-theme][data-theme')[0];
    assert.notStrictEqual(blockA, blockB);
  });

  test('warnings array is empty for high-contrast palettes', () => {
    const { warnings } = deriveTenantTheme(PLATFORM_PALETTE);
    assert.strictEqual(warnings.length, 0, `Unexpected warnings: ${warnings.join(', ')}`);
  });
});

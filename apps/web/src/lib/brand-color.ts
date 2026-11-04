/** WCAG contrast of a hex color against white. */
function contrastWithWhite(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return 1.05 / (luminance + 0.05);
}

/**
 * A tenant's brand color is used for white-on-primary buttons and primary text, so it must reach
 * WCAG AA against white. Unreadable or invalid colors fall back to the platform emerald (null).
 */
export function readableBrandColor(color: string | null | undefined): string | null {
  if (!color || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return null;
  return contrastWithWhite(color) >= 4.5 ? color : null;
}

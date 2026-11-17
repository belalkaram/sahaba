/**
 * TL-3 (ADR-007): Template manifest type.
 * Each manifest is the declarative definition of a template's visual language.
 * The actual section components live in the template's own directory.
 */
export type TemplateId = 'oasis' | 'beacon' | 'breeze' | 'atlas' | 'horizon';

export interface TemplateManifest {
  id: TemplateId;
  /** Arabic display name shown in the template picker. */
  nameAr: string;
  /** One-line audience description shown in the editor. */
  audienceAr: string;
  /** Corner radius scale used across all cards and buttons. */
  radius: 'none' | 'sm' | 'lg' | 'full';
  /** Decorative shape motif. */
  shape: 'arch' | 'square' | 'blob' | 'hex' | 'line';
  /** Icon visual style. */
  iconStyle: {
    strokeWidth: 1.5 | 1.75 | 2;
    container: 'none' | 'soft' | 'outline' | 'filled';
  };
  /** Card style. */
  card: 'flat' | 'elevated' | 'outlined' | 'glass' | 'split';
  /** Header layout style. */
  header: 'centered' | 'split' | 'minimal' | 'bar';
  /** Hero section style. */
  hero: 'arch-visual' | 'editorial' | 'soft-cards' | 'grid-stats' | 'plain';
  /** Animation preference (respects prefers-reduced-motion). */
  motion: 'none' | 'subtle' | 'lively';
}

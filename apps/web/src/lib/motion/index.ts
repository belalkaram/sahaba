'use client';

/**
 * Motion system (plan §10). GSAP is registered once, client-side only.
 * Rules: animate transform/opacity only; every tween lives inside useGSAP (auto-reverted on
 * unmount); prefers-reduced-motion collapses movement to a short fade.
 */

import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, Flip);
  gsap.defaults({ ease: 'power3.out', duration: 0.25 });
}

export { gsap, Flip, useGSAP };

export const MOTION = {
  duration: { fast: 0.15, base: 0.25, slow: 0.45, page: 0.5, count: 0.8 },
  ease: { out: 'power3.out', inOut: 'power2.inOut', spring: 'back.out(1.4)' },
  stagger: 0.05,
  /** Max items that stagger individually; the rest appear together. */
  staggerCap: 8,
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** +1 in RTL, -1 in LTR — so horizontal entrances come from the inline-start side. */
export function inlineStartSign(el?: Element | null): 1 | -1 {
  const dir = el ? getComputedStyle(el).direction : typeof document !== 'undefined' ? document.dir : 'rtl';
  return dir === 'ltr' ? -1 : 1;
}

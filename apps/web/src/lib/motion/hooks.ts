'use client';

import { useRef } from 'react';
import { gsap, useGSAP, MOTION, prefersReducedMotion } from './index';
import { formatNumber } from '../format';

/**
 * Fades + lifts the matched children of `scope` in sequence. Runs on mount and whenever
 * `dependencies` change (e.g. data finished loading).
 */
export function useReveal<T extends HTMLElement>(
  selector = ':scope > *',
  dependencies: unknown[] = [],
  { y = 12, stagger = MOTION.stagger }: { y?: number; stagger?: number } = {},
) {
  const scope = useRef<T>(null);
  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(selector));
      if (!items.length) return;
      const reduced = prefersReducedMotion();
      const head = items.slice(0, MOTION.staggerCap);
      const tail = items.slice(MOTION.staggerCap);
      gsap.from(head, {
        autoAlpha: 0,
        y: reduced ? 0 : y,
        duration: reduced ? MOTION.duration.fast : MOTION.duration.slow,
        stagger: reduced ? 0 : stagger,
        clearProps: 'transform,opacity,visibility',
      });
      if (tail.length) {
        gsap.from(tail, { autoAlpha: 0, duration: MOTION.duration.base, delay: 0.2, clearProps: 'opacity,visibility' });
      }
    },
    { scope, dependencies },
  );
  return scope;
}

/** Counts a number up from 0 into the returned span ref, formatted with Arabic digits. */
export function useCountUp(value: number | null | undefined, format: (n: number) => string = (n) => formatNumber(n)) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || value === null || value === undefined || Number.isNaN(value)) return;
      if (prefersReducedMotion() || value === 0) {
        el.textContent = format(value);
        return;
      }
      const state = { n: 0 };
      gsap.to(state, {
        n: value,
        duration: MOTION.duration.count,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = format(Number.isInteger(value) ? Math.round(state.n) : Math.round(state.n * 10) / 10);
        },
      });
    },
    { dependencies: [value] },
  );
  return ref;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap, MOTION, prefersReducedMotion } from './index';

/**
 * Keeps an overlay mounted while its exit animation runs.
 * `enter`/`exit` receive the backdrop and panel elements; both default to a fade.
 */
export function usePresence(
  isOpen: boolean,
  {
    panelFrom = { y: 16, scale: 0.98 },
  }: { panelFrom?: gsap.TweenVars } = {},
) {
  const [rendered, setRendered] = useState(isOpen);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mount immediately when opening.
  useEffect(() => {
    if (isOpen) setRendered(true);
  }, [isOpen]);

  useEffect(() => {
    if (!rendered) return;
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!backdrop || !panel) return;
    const reduced = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (isOpen) {
        gsap.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: MOTION.duration.base });
        gsap.fromTo(
          panel,
          { autoAlpha: 0, ...(reduced ? {} : panelFrom) },
          // xPercent/yPercent must be reset explicitly: `x: 0` does not undo a percent offset,
          // which left drawers parked off-screen behind the blurred backdrop.
          { autoAlpha: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, scale: 1, duration: MOTION.duration.base, ease: MOTION.ease.out },
        );
      } else {
        gsap.to(backdrop, { autoAlpha: 0, duration: MOTION.duration.fast });
        gsap.to(panel, {
          autoAlpha: 0,
          ...(reduced ? {} : panelFrom),
          duration: MOTION.duration.fast,
          ease: MOTION.ease.inOut,
          onComplete: () => setRendered(false),
        });
      }
    });
    return () => ctx.kill();
    // panelFrom is a static config object per component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, rendered]);

  return { rendered, backdropRef, panelRef };
}

/** Moves focus into the panel on open and restores it on close; closes on Escape. */
export function useDialogFocus(isOpen: boolean, panel: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const focusable = el?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-dialog-close]), [href], [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? el)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [isOpen, panel, onClose]);
}

'use client';

import { useEffect, useLayoutEffect } from 'react';
import { homePathFor, useAuth } from '../../context/auth-context';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    /** Set once the landing motion code has run; read by the boot script's failsafe (app/layout.tsx). */
    __sahabaMotion?: boolean;
  }
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Landing animations as one client island, so the page itself stays a server component.
 * GSAP and its plugins are loaded on demand. Elements start hidden through CSS
 * (html.motion-ready); the class is removed in the same tick the tweens are created, so there is
 * no visible-then-hidden flash.
 */
export function LandingMotion() {
  // Coming back to the landing by client navigation: hide again before paint, JS is known to work.
  useIsomorphicLayoutEffect(() => {
    if (window.__sahabaMotion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('motion-ready');
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Not set: reduced motion, or the failsafe already showed the content. Leave it as it is.
    if (!root.classList.contains('motion-ready')) return;

    let cancelled = false;
    const cleanups: (() => void)[] = [];

    (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }, { DrawSVGPlugin }] = await Promise.all([
          import('../../lib/motion'),
          import('gsap/ScrollTrigger'),
          import('gsap/DrawSVGPlugin'),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin);
        window.__sahabaMotion = true;
        // gsap.from() reads the current styles as the end state, so the CSS hiding goes first.
        root.classList.remove('motion-ready');

        const rtl = document.dir !== 'ltr';
        const ctx = gsap.context(() => {
          // The hero entrance itself is CSS (globals.css) so it does not wait for this bundle.
          gsap.from('[data-hero-progress]', {
            scaleX: 0,
            transformOrigin: rtl ? 'right center' : 'left center',
            duration: 0.8,
            delay: 0.5,
            ease: 'power3.out',
          });

          // The khatam lattice draws itself once.
          const paths = gsap.utils.toArray<SVGPathElement>('[data-hero-pattern] [data-draw]');
          if (paths.length) {
            gsap.set('[data-hero-pattern]', { autoAlpha: 1 });
            gsap.from(paths, { drawSVG: '0%', duration: 1.5, stagger: 0.05, ease: 'power2.inOut' });
          }

          // The scattered tools drift toward the single panel as the section passes.
          const converge = gsap.utils.toArray<HTMLElement>('[data-converge]');
          if (converge.length && window.matchMedia('(min-width: 1024px)').matches) {
            gsap.to(converge, {
              // Toward the panel, which sits on the inline-end side.
              x: rtl ? -28 : 28,
              opacity: 0.5,
              ease: 'none',
              stagger: 0.04,
              scrollTrigger: { trigger: '[data-converge-target]', start: 'top 85%', end: 'top 40%', scrub: 0.6 },
            });
          }

          // Metric bars grow from their own side once the panel is in view.
          gsap.utils.toArray<HTMLElement>('[data-bar]').forEach((bar) => {
            gsap.from(bar, {
              scaleX: 0,
              transformOrigin: rtl ? 'right center' : 'left center',
              duration: 0.9,
              ease: 'power3.out',
              scrollTrigger: { trigger: bar, start: 'top 90%', once: true },
            });
          });

          gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
            gsap.from(group.querySelectorAll('[data-reveal]'), {
              autoAlpha: 0,
              y: 28,
              duration: 0.7,
              stagger: 0.08,
              ease: 'power3.out',
              clearProps: 'transform,opacity,visibility',
              scrollTrigger: { trigger: group, start: 'top 82%', once: true },
            });
          });

          cleanups.push(magnetic(gsap));
          cleanups.push(dragRails());
        });
        cleanups.push(() => ctx.revert());
      } catch {
        // Motion is an enhancement: if it cannot load, show the content.
        root.classList.remove('motion-ready');
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}

/**
 * Lets a mouse drag the horizontal card rails, the way a finger already can. Touch is untouched:
 * the browser's own scrolling is smoother than anything re-implemented here.
 */
function dragRails(): () => void {
  const rails = Array.from(document.querySelectorAll<HTMLElement>('[data-rail]'));
  if (!rails.length || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  const cleanups: (() => void)[] = [];
  rails.forEach((rail) => {
    let startX = 0;
    let startScroll = 0;
    let dragging = false;

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || rail.scrollWidth <= rail.clientWidth) return;
      dragging = true;
      startX = e.clientX;
      startScroll = rail.scrollLeft;
      rail.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      rail.scrollLeft = startScroll - (e.clientX - startX);
    };
    const up = () => {
      dragging = false;
      rail.style.cursor = '';
    };

    rail.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    cleanups.push(() => {
      rail.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

/** A CTA that leans very slightly toward the cursor. Pointer devices only, never on touch. */
function magnetic(gsap: typeof import('gsap').gsap): () => void {
  const buttons = gsap.utils.toArray<HTMLElement>('[data-magnetic]');
  if (!buttons.length || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  const listeners: (() => void)[] = [];
  buttons.forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      x(gsap.utils.clamp(-8, 8, (event.clientX - (box.left + box.width / 2)) * 0.25));
      y(gsap.utils.clamp(-6, 6, (event.clientY - (box.top + box.height / 2)) * 0.35));
    };
    const reset = () => {
      x(0);
      y(0);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    listeners.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
    });
  });

  return () => listeners.forEach((fn) => fn());
}

/**
 * Fallback for sessions that predate the `lms_home` cookie: the proxy could not redirect them,
 * so send a signed-in visitor to their dashboard once the session is known.
 */
export function SignedInRedirect() {
  const { isAuthenticated, experience, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(homePathFor(experience));
  }, [isLoading, isAuthenticated, experience, router]);
  return null;
}

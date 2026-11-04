'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IntegrityEventType } from '../../lib/assessment-api';

/**
 * Browser-side exam hardening. This is a deterrent and an evidence trail, NOT a security boundary:
 * a determined user can bypass any browser restriction. The server owns timing, attempt ownership
 * and the violation limit; these signals are reported to it and shown to the teacher.
 */
export interface LockdownOptions {
  /** Enable only while an attempt is running. */
  active: boolean;
  /** Counted events (leaving the tab/window/fullscreen). */
  onViolation: (type: IntegrityEventType) => void;
  /** Blocked actions (copy/paste/context menu/shortcuts): logged, not counted. */
  onBlocked: (type: IntegrityEventType) => void;
}

const DEBOUNCE_MS = 1500;
const BLOCKED_LOG_INTERVAL_MS = 5000;

function isBlockedShortcut(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'F12') return true;
  if (mod && e.shiftKey && ['i', 'j', 'c'].includes(key)) return true; // devtools / inspect
  if (mod && ['u', 's', 'p'].includes(key)) return true; // view-source / save / print
  if (e.altKey && e.key === 'F4') return false; // OS-level, cannot be intercepted anyway
  return false;
}

export function useExamLockdown({ active, onViolation, onBlocked }: LockdownOptions) {
  const supportsFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled === true;
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Latest callbacks without re-binding listeners.
  const violationRef = useRef(onViolation);
  const blockedRef = useRef(onBlocked);
  useEffect(() => {
    violationRef.current = onViolation;
    blockedRef.current = onBlocked;
  });

  const lastViolationAt = useRef(0);
  const lastBlockedAt = useRef(0);

  const enterFullscreen = useCallback(async () => {
    if (!supportsFullscreen) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // The browser refused (no user gesture / policy). The runner keeps showing the "return" gate.
    }
  }, [supportsFullscreen]);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    onFsChange();
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!active) return;

    // One physical switch usually fires blur + visibilitychange (+ fullscreenchange): count it once.
    const violate = (type: IntegrityEventType) => {
      const now = Date.now();
      if (now - lastViolationAt.current < DEBOUNCE_MS) return;
      lastViolationAt.current = now;
      violationRef.current(type);
    };
    const blocked = (type: IntegrityEventType) => {
      const now = Date.now();
      if (now - lastBlockedAt.current < BLOCKED_LOG_INTERVAL_MS) return;
      lastBlockedAt.current = now;
      blockedRef.current(type);
    };

    const onVisibility = () => document.hidden && violate('tab_hidden');
    const onBlur = () => {
      // Ignore blur caused by moving focus into the page itself (iframes, dialogs).
      window.setTimeout(() => {
        if (!document.hidden && !document.hasFocus()) violate('window_blur');
      }, 250);
    };
    const onFullscreen = () => {
      if (supportsFullscreen && !document.fullscreenElement) violate('fullscreen_exit');
    };

    const stop = (type: IntegrityEventType) => (e: Event) => {
      e.preventDefault();
      blocked(type);
    };
    const onCopy = stop('copy_attempt');
    const onPaste = stop('paste_attempt');
    const onContext = stop('context_menu');
    const onDrag = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      if (isBlockedShortcut(e)) {
        e.preventDefault();
        blocked('blocked_shortcut');
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('dragstart', onDrag);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('dragstart', onDrag);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [active, supportsFullscreen]);

  return { supportsFullscreen, isFullscreen, enterFullscreen, exitFullscreen };
}

'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Typed answers must be written inside the page: pasting, dropping text in, cutting and copying out are
 * blocked on the answer field. Deterrent only (a determined user can retype or use another device); the
 * exam runner additionally logs the attempts for the teacher.
 */
const BLOCKED_INPUT_TYPES = ['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank'];

export function useNoPaste(onBlocked?: () => void) {
  const [hint, setHint] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback(() => {
    setHint(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHint(false), 3500);
    onBlocked?.();
  }, [onBlocked]);

  const block = useCallback(
    (e: { preventDefault: () => void }) => {
      e.preventDefault();
      notify();
    },
    [notify],
  );

  /** Native `beforeinput` carries inputType, which catches middle-click / mobile / IME paste that `onPaste` can miss. */
  const ref = useCallback(
    (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (!el) return;
      el.addEventListener('beforeinput', (e) => {
        if (BLOCKED_INPUT_TYPES.includes((e as InputEvent).inputType)) {
          e.preventDefault();
          notify();
        }
      });
    },
    [notify],
  );

  const props = {
    ref,
    onPaste: block,
    onDrop: block,
    onCut: block,
    onCopy: block,
    onDragOver: (e: { preventDefault: () => void }) => e.preventDefault(),
    onContextMenu: block,
    autoComplete: 'off',
    autoCorrect: 'off',
    spellCheck: false,
  } as const;

  return { props, hint };
}

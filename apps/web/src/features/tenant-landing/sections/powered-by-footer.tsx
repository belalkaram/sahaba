/**
 * TL-3 (ADR-007): Mandatory platform attribution footer.
 *
 * SECURITY INVARIANT: This component is rendered by the layout server-side, OUTSIDE
 * any template scope. No template can hide, override, or reorder it. The
 * «مدعوم بمنصة سحابة» text is an unconditional part of every public academy page.
 *
 * Not a client component — no 'use client', no hooks, no dynamic import.
 */
import React from 'react';
import Link from 'next/link';
import { BRAND } from '../../../config/brand';

interface Props {
  academyName: string;
}

/** Platform attribution footer — always rendered by the layout, never by template code. */
export function PoweredByFooter({ academyName }: Props) {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[var(--content-max)] flex-col items-center justify-between gap-2 px-4 py-6 text-center text-sm text-fg-muted sm:flex-row sm:px-6 sm:text-start">
        <p className="break-words">
          © {new Date().getFullYear()} {academyName}
        </p>
        <p>
          مدعوم بمنصة{' '}
          <Link
            href="/"
            className="font-semibold text-primary underline underline-offset-2"
          >
            {BRAND.nameAr}
          </Link>
        </p>
      </div>
    </footer>
  );
}

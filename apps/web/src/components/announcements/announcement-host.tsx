'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, Megaphone, TriangleAlert, X } from 'lucide-react';
import { announcementApi, type AnnouncementTone, type MyAnnouncement } from '../../lib/announcement-api';
import { tokenStore } from '../../lib/token-store';
import { cn } from '../../lib/cn';

/**
 * OD-37: shows the academy's announcements to the signed-in student or parent.
 *
 * - banner: a bar at the top of every page until closed with ×.
 * - modal: a pop-up that blocks the page and closes only with × (no backdrop click, no Escape).
 * - once: closing it ends it for good (recorded on the server).
 * - persistent: comes back on every sign-in until the academy ends or withdraws it; closing hides it for this sign-in.
 */

const TONE: Record<AnnouncementTone, { box: string; icon: React.ElementType }> = {
  info: { box: 'border-info/30 bg-info-subtle text-info-subtle-fg', icon: Info },
  success: { box: 'border-success/30 bg-success-subtle text-success-subtle-fg', icon: CircleCheck },
  warning: { box: 'border-warning/30 bg-warning-subtle text-warning-subtle-fg', icon: TriangleAlert },
  danger: { box: 'border-danger/30 bg-danger-subtle text-danger-subtle-fg', icon: CircleAlert },
};

/** Per sign-in memory: a new token (new sign-in) starts clean, so persistent announcements come back. */
function sessionKey(kind: 'closed' | 'seen'): string {
  const token = tokenStore.getToken() ?? '';
  return `sahaba:ann-${kind}:${token.slice(-12)}`;
}

function readSet(kind: 'closed' | 'seen'): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(sessionKey(kind)) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function addToSet(kind: 'closed' | 'seen', id: string): void {
  try {
    const set = readSet(kind);
    set.add(id);
    sessionStorage.setItem(sessionKey(kind), JSON.stringify([...set]));
  } catch {
    // Storage blocked: the server still records receipts; the item may simply show again.
  }
}

export function AnnouncementHost({ placement }: { placement: 'banners' | 'modal' }) {
  const items = useAnnouncements();
  const visible = items.list.filter((a) => !items.closed.has(a.id));

  if (placement === 'banners') {
    const banners = visible.filter((a) => a.display === 'banner');
    if (banners.length === 0) return null;
    return (
      <div className="space-y-3" aria-label="إعلانات الأكاديمية">
        {banners.map((a) => (
          <AnnouncementBanner key={a.id} item={a} onSeen={items.markSeen} onClose={items.close} />
        ))}
      </div>
    );
  }

  const modal = visible.find((a) => a.display === 'modal');
  return modal ? <AnnouncementModal key={modal.id} item={modal} onSeen={items.markSeen} onClose={items.close} /> : null;
}

/** Shared state so the banner slot and the modal slot read one request. */
const listeners = new Set<() => void>();
let cache: { list: MyAnnouncement[]; closed: Set<string>; loaded: boolean; token: string | null } = { list: [], closed: new Set(), loaded: false, token: null };

function emit() {
  listeners.forEach((l) => l());
}

function useAnnouncements() {
  const [, force] = useState(0);
  const loading = useRef(false);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    const token = tokenStore.getToken();
    if ((!cache.loaded || cache.token !== token) && !loading.current) {
      loading.current = true;
      cache = { list: [], closed: readSet('closed'), loaded: true, token };
      announcementApi
        .mine()
        .then((list) => {
          cache = { ...cache, list };
          emit();
        })
        .catch(() => {
          // Announcements must never break a page; they will load on the next visit.
        })
        .finally(() => {
          loading.current = false;
        });
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const markSeen = useCallback((id: string) => {
    if (readSet('seen').has(id)) return;
    addToSet('seen', id);
    announcementApi.seen(id).catch(() => undefined);
  }, []);

  const close = useCallback((id: string) => {
    addToSet('closed', id);
    cache = { ...cache, closed: new Set([...cache.closed, id]) };
    emit();
    announcementApi.dismiss(id).catch(() => undefined);
  }, []);

  return { list: cache.list, closed: cache.closed, markSeen, close };
}

function AnnouncementBanner({ item, onSeen, onClose }: { item: MyAnnouncement; onSeen: (id: string) => void; onClose: (id: string) => void }) {
  const tone = TONE[item.tone] ?? TONE.info;
  const Icon = tone.icon;
  useEffect(() => onSeen(item.id), [item.id, onSeen]);

  return (
    <div role="status" className={cn('flex items-start gap-3 rounded-lg border px-4 py-3', tone.box)}>
      <Icon size={20} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{item.title}</p>
        <p className="mt-0.5 whitespace-pre-line break-words text-sm">{item.body}</p>
      </div>
      <button
        type="button"
        onClick={() => onClose(item.id)}
        className="-me-1 grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10"
        aria-label={`إغلاق الإعلان: ${item.title}`}
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}

function AnnouncementModal({ item, onSeen, onClose }: { item: MyAnnouncement; onSeen: (id: string) => void; onClose: (id: string) => void }) {
  const tone = TONE[item.tone] ?? TONE.info;
  const Icon = tone.icon;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onSeen(item.id);
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [item.id, onSeen]);

  // Keep keyboard focus inside the dialog; only × closes it.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      closeRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div className="fixed inset-0 bg-surface-overlay backdrop-blur-[2px]" aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`ann-title-${item.id}`}
        aria-describedby={`ann-body-${item.id}`}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface-raised shadow-xl"
      >
        <div className={cn('flex items-center gap-3 border-b px-5 py-4', tone.box)}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-raised/60">
            <Icon size={22} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
              <Megaphone size={14} aria-hidden /> إعلان من الأكاديمية
            </p>
            <h2 id={`ann-title-${item.id}`} className="break-words text-lg font-bold">
              {item.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose(item.id)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="إغلاق الإعلان"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        <div id={`ann-body-${item.id}`} className="max-h-[60vh] overflow-y-auto whitespace-pre-line break-words px-5 py-5 text-base leading-relaxed text-fg">
          {item.body}
        </div>
      </div>
    </div>
  );
}

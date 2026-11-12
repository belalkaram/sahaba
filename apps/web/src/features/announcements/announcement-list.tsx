'use client';

import React from 'react';
import { Bell, CalendarClock, Eye, PanelTop, SquareStack, Users } from 'lucide-react';
import type { Announcement, AnnouncementDisplay } from '../../lib/announcement-api';
import { Badge } from '../../components/ui/badge';
import { ProgressBar } from '../../components/ui/progress-bar';
import { buttonClasses } from '../../components/ui/button-styles';
import { formatDateTime, formatNumber, formatPercent } from '../../lib/format';
import { DISPLAY_COPY, FREQUENCY_COPY, STATE_COPY, TARGET_COPY } from './labels';

const DISPLAY_ICON: Record<AnnouncementDisplay, React.ElementType> = { bell: Bell, banner: PanelTop, modal: SquareStack };

export function AnnouncementCard({ item, onRecipients, onWithdraw }: { item: Announcement; onRecipients: () => void; onWithdraw: () => void }) {
  const Icon = DISPLAY_ICON[item.display];
  const state = STATE_COPY[item.state];
  const seenRate = item.recipients_count ? (item.seen_count / item.recipients_count) * 100 : 0;
  const who = [item.audience.students && 'الطلاب', item.audience.parents && 'أولياء الأمور'].filter(Boolean).join(' و');

  return (
    <article className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-bold text-fg">{item.title}</h3>
          <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-fg-muted">{item.body}</p>
        </div>
        <Badge variant={state.variant}>{state.label}</Badge>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2.5 py-1 font-medium text-fg">
          <Icon size={14} aria-hidden /> {DISPLAY_COPY[item.display].label}
          {item.display !== 'bell' && ` — ${FREQUENCY_COPY[item.frequency].label}`}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2.5 py-1 font-medium text-fg">
          <Users size={14} aria-hidden /> {TARGET_COPY[item.audience.target]}
          {item.audience.target !== 'all' && ` (${formatNumber(item.audience.ids.length)})`} — {who}
        </span>
        {(item.starts_at || item.ends_at) && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2.5 py-1 font-medium text-fg">
            <CalendarClock size={14} aria-hidden />
            {item.starts_at && `من ${formatDateTime(item.starts_at)}`} {item.ends_at && `حتى ${formatDateTime(item.ends_at)}`}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="text-fg-muted">
            شاهده {formatNumber(item.seen_count)} من {formatNumber(item.recipients_count)}
            {item.display !== 'bell' && ` · أغلقه ${formatNumber(item.dismissed_count)}`}
          </span>
          <span className="font-mono font-bold text-fg">{formatPercent(seenRate)}</span>
        </div>
        <ProgressBar value={seenRate} variant={seenRate >= 80 ? 'success' : 'primary'} />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-fg-muted">
        <span>
          {item.author ? `${item.author} · ` : ''}
          {item.created_at ? formatDateTime(item.created_at) : ''}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onRecipients} className={buttonClasses('secondary', 'sm')}>
            <Eye size={15} aria-hidden /> من شاهده؟
          </button>
          {item.state !== 'withdrawn' && item.state !== 'ended' && (
            <button type="button" onClick={onWithdraw} className={buttonClasses('ghost', 'sm') + ' text-danger'}>
              سحب الإعلان
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

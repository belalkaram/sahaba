'use client';

import React, { useEffect, useState } from 'react';
import { announcementApi, type Announcement, type AnnouncementRecipient } from '../../lib/announcement-api';
import { Drawer } from '../../components/ui/drawer';
import { Tabs } from '../../components/ui/tabs';
import { SearchInput } from '../../components/ui/search-input';
import { Pagination } from '../../components/ui/pagination';
import { Badge } from '../../components/ui/badge';
import { ErrorState } from '../../components/ui/error-state';
import { formatDateTime, formatNumber } from '../../lib/format';

type StateFilter = 'all' | 'seen' | 'unseen' | 'dismissed';

/** Who exactly received an announcement and what each person did with it. */
export function RecipientsDrawer({ announcement, onClose }: { announcement: Announcement | null; onClose: () => void }) {
  const [state, setState] = useState<StateFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AnnouncementRecipient[]; total: number; lastPage: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  const id = announcement?.id;
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setFailed(false);
    setData(null);
    announcementApi
      .recipients(id, { state: state === 'all' ? undefined : state, search: search || undefined, page })
      .then((res) => !cancelled && setData(res))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id, state, search, page, reload]);

  useEffect(() => {
    setState('all');
    setSearch('');
    setPage(1);
  }, [id]);

  const a = announcement;
  return (
    <Drawer isOpen={Boolean(a)} onClose={onClose} title="المستلمون" subtitle={a?.title} width="xl">
      {a && (
        <div className="space-y-4">
          <Tabs
            variant="underline"
            activeTab={state}
            onChange={(t) => {
              setState(t as StateFilter);
              setPage(1);
            }}
            tabs={[
              { id: 'all', label: 'الكل', badge: formatNumber(a.recipients_count) },
              { id: 'seen', label: 'شاهده', badge: formatNumber(a.seen_count) },
              { id: 'unseen', label: 'لم يشاهده', badge: formatNumber(Math.max(0, a.recipients_count - a.seen_count)) },
              ...(a.display !== 'bell' ? [{ id: 'dismissed', label: 'أغلقه', badge: formatNumber(a.dismissed_count) }] : []),
            ]}
          />
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="ابحث بالاسم أو الجوال"
          />
          {failed ? (
            <ErrorState onRetry={() => setReload((n) => n + 1)} />
          ) : !data ? (
            <div className="h-40 animate-pulse rounded-md bg-surface-muted" aria-busy="true" />
          ) : data.items.length === 0 ? (
            <p className="rounded-md bg-surface-sunken p-4 text-center text-sm text-fg-muted">لا أحد في هذه القائمة.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {data.items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-fg">{r.name ?? '—'}</p>
                    <p className="text-xs text-fg-muted">{r.role === 'parent' ? `ولي أمر ${r.student_name ?? ''}` : 'طالب'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {r.dismissed_at ? (
                      <Badge variant="success">أغلقه {formatDateTime(r.dismissed_at)}</Badge>
                    ) : r.first_seen_at ? (
                      <Badge variant="info">شاهده {formatDateTime(r.first_seen_at)}</Badge>
                    ) : (
                      <Badge variant="neutral">لم يشاهده بعد</Badge>
                    )}
                    {r.seen_count > 1 && <span className="text-fg-muted">{formatNumber(r.seen_count)} مرات</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data && data.lastPage > 1 && <Pagination currentPage={page} totalPages={data.lastPage} onPageChange={setPage} totalItems={data.total} pageSize={25} />}
        </div>
      )}
    </Drawer>
  );
}

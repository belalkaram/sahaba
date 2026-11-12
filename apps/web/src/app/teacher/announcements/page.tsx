'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import { ApiError } from '../../../lib/api-client';
import { announcementApi, type Announcement, type AnnouncementOptions, type AnnouncementState } from '../../../lib/announcement-api';
import { PageHeader } from '../../../components/ui/page-header';
import { Tabs } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Forbidden } from '../../../components/ui/forbidden';
import { Pagination } from '../../../components/ui/pagination';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { useToast } from '../../../components/ui/toast';
import { ComposeAnnouncement } from '../../../features/announcements/compose-form';
import { AnnouncementCard } from '../../../features/announcements/announcement-list';
import { RecipientsDrawer } from '../../../features/announcements/recipients-drawer';

type Filter = 'all' | AnnouncementState;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'live', label: 'منشورة الآن' },
  { id: 'scheduled', label: 'مجدولة' },
  { id: 'ended', label: 'منتهية' },
  { id: 'withdrawn', label: 'مسحوبة' },
];

type Load = { s: 'loading' } | { s: 'forbidden' } | { s: 'error' } | { s: 'ready'; items: Announcement[]; lastPage: number; total: number };

/** OD-37 (ANN-1): academy announcements — compose with an exact audience, choose how it appears, follow who saw it. */
export default function AnnouncementsPage() {
  const toast = useToast();
  const [options, setOptions] = useState<AnnouncementOptions | null>(null);
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [recipientsOf, setRecipientsOf] = useState<Announcement | null>(null);
  const [withdrawing, setWithdrawing] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchList = useCallback(async () => {
    setLoad({ s: 'loading' });
    try {
      const res = await announcementApi.list({ status: filter === 'all' ? undefined : filter, page });
      setLoad({ s: 'ready', items: res.items, lastPage: res.lastPage, total: res.total });
    } catch (err) {
      setLoad(err instanceof ApiError && err.status === 403 ? { s: 'forbidden' } : { s: 'error' });
    }
  }, [filter, page]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    announcementApi.options().then(setOptions).catch(() => setOptions(null));
  }, []);

  const withdraw = async () => {
    if (!withdrawing) return;
    setBusy(true);
    try {
      await announcementApi.withdraw(withdrawing.id);
      toast.success('تم سحب الإعلان', 'لن يظهر لأي مستلم بعد الآن.');
      setWithdrawing(null);
      void fetchList();
    } catch {
      toast.danger('تعذّر سحب الإعلان');
    } finally {
      setBusy(false);
    }
  };

  if (load.s === 'forbidden') return <Forbidden />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعلانات والتعميمات"
        description="أرسل إعلاناً لفئة محددة من الطلاب أو أولياء أمورهم، كإشعار عادي أو شريط أعلى الصفحة أو نافذة منبثقة لا تُغلق إلا بـ ×، وتابع من شاهده."
        actions={
          !composing && options ? (
            <Button onClick={() => setComposing(true)}>
              <Plus size={16} aria-hidden /> إعلان جديد
            </Button>
          ) : undefined
        }
      />

      {composing && options && (
        <ComposeAnnouncement
          options={options}
          onCancel={() => setComposing(false)}
          onCreated={(a) => {
            setComposing(false);
            toast.success('تم نشر الإعلان', `وصل إلى ${a.recipients_count} شخصاً.`);
            setFilter('all');
            setPage(1);
            void fetchList();
          }}
        />
      )}

      <Tabs
        tabs={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
        activeTab={filter}
        onChange={(t) => {
          setFilter(t as Filter);
          setPage(1);
        }}
      />

      {load.s === 'error' ? (
        <ErrorState onRetry={() => void fetchList()} />
      ) : load.s === 'loading' ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      ) : load.items.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={20} aria-hidden />}
          title={filter === 'all' ? 'لم ترسل أي إعلان بعد' : 'لا توجد إعلانات هنا'}
          description="الإعلان يصل فوراً لمن تختاره، ويمكنك سحبه في أي وقت."
          action={options && !composing ? { label: 'إعلان جديد', onClick: () => setComposing(true) } : undefined}
        />
      ) : (
        <div className="space-y-4">
          {load.items.map((a) => (
            <AnnouncementCard key={a.id} item={a} onRecipients={() => setRecipientsOf(a)} onWithdraw={() => setWithdrawing(a)} />
          ))}
          {load.lastPage > 1 && <Pagination currentPage={page} totalPages={load.lastPage} onPageChange={setPage} totalItems={load.total} pageSize={20} />}
        </div>
      )}

      <RecipientsDrawer announcement={recipientsOf} onClose={() => setRecipientsOf(null)} />
      <ConfirmDialog
        isOpen={Boolean(withdrawing)}
        onClose={() => setWithdrawing(null)}
        onConfirm={withdraw}
        isLoading={busy}
        isDestructive
        title="سحب الإعلان؟"
        description={`سيختفي «${withdrawing?.title ?? ''}» من شاشات كل المستلمين فوراً. يبقى في سجلك مع إحصاءاته.`}
        confirmText="سحب الإعلان"
      />
    </div>
  );
}

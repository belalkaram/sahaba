'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Search, Users } from 'lucide-react';
import { publicApi, type DirectoryAcademy, type DirectoryQuery, type DirectoryTeacher, type Pagination } from '../../lib/public-api';
import { AcademyCard, TeacherCard } from '../landing/showcase';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { formatNumber } from '../../lib/format';

type Kind = 'academies' | 'teachers';

export interface DirectoryInitial<T> {
  items: T[];
  pagination: Pagination | null;
}

const TYPES = [
  { value: '', label: 'كل الأنواع' },
  { value: 'organization', label: 'مراكز وأكاديميات ومدارس' },
  { value: 'individual_teacher', label: 'مدرسون مستقلون' },
];

const SERVICES = [
  { value: '', label: 'كل الخدمات' },
  { value: 'online', label: 'أونلاين' },
  { value: 'offline', label: 'حضوري' },
];

/**
 * Public directory list with search, filters and "load more". The first page is rendered on the
 * server, so the page has content before this component runs; changing a filter asks the API.
 */
export function DirectoryView<T extends DirectoryAcademy | DirectoryTeacher>({
  kind,
  initial,
}: {
  kind: Kind;
  initial: DirectoryInitial<T>;
}) {
  const [items, setItems] = useState<T[]>(initial.items);
  const [pagination, setPagination] = useState<Pagination | null>(initial.pagination);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [loadingMore, setLoadingMore] = useState(false);
  // Skips the fetch for the filters' own first render, since the server already sent page 1.
  const untouched = useRef(true);

  const fetchPage = useCallback(
    async (page: number): Promise<{ items: T[]; pagination: Pagination }> => {
      const query: DirectoryQuery = { page, per_page: 12 };
      if (search.trim()) query.search = search.trim();
      if (city.trim()) query.city = city.trim();
      if (kind === 'academies') {
        if (type) query.type = type as DirectoryQuery['type'];
        if (service) query.service = service as DirectoryQuery['service'];
        const res = await publicApi.getDirectoryAcademies(query);
        return { items: res.academies as T[], pagination: res.pagination };
      }
      const res = await publicApi.getDirectoryTeachers(query);
      return { items: res as T[], pagination: { total: res.length, page, per_page: 12, last_page: page } };
    },
    [kind, search, city, type, service],
  );

  // Debounced reload whenever a filter changes.
  useEffect(() => {
    if (untouched.current) {
      untouched.current = false;
      return;
    }
    let cancelled = false;
    setStatus('loading');
    const timer = setTimeout(() => {
      fetchPage(1)
        .then((res) => {
          if (cancelled) return;
          setItems(res.items);
          setPagination(res.pagination);
          setStatus('idle');
        })
        .catch(() => !cancelled && setStatus('error'));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchPage]);

  const loadMore = async () => {
    if (!pagination) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(pagination.page + 1);
      setItems((current) => [...current, ...res.items]);
      setPagination(res.pagination);
    } catch {
      setStatus('error');
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = pagination !== null && pagination.page < pagination.last_page;
  const label = kind === 'academies' ? 'أكاديمية' : 'معلم';

  return (
    <div className="space-y-8">
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2 lg:col-span-2">
          <span className="sr-only">بحث</span>
          <Search size={16} className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={kind === 'academies' ? 'ابحث باسم الأكاديمية أو المدينة' : 'ابحث باسم المعلم أو تخصصه'}
            className="h-11 w-full rounded-md border border-border bg-surface-sunken ps-9 pe-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-primary focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </label>

        <label>
          <span className="sr-only">المدينة</span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="المدينة"
            className="h-11 w-full rounded-md border border-border bg-surface-sunken px-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-primary focus:ring-2 focus:ring-[var(--primary-ring)]"
          />
        </label>

        {kind === 'academies' ? (
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="sr-only">النوع</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-surface-sunken px-2 text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-[var(--primary-ring)]"
              >
                {TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">الخدمة</span>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-surface-sunken px-2 text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-[var(--primary-ring)]"
              >
                {SERVICES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="hidden items-center text-sm text-fg-subtle lg:flex">يظهر هنا المعلمون الذين فعّلوا ملفهم العام.</p>
        )}
      </div>

      <div aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'error' ? (
          <ErrorState title="تعذّر تحميل القائمة" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={() => setSearch((s) => s)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={kind === 'academies' ? <Building2 size={22} aria-hidden /> : <Users size={22} aria-hidden />}
            title={search || city || type || service ? 'لا نتائج مطابقة' : `لا توجد ${label === 'أكاديمية' ? 'أكاديميات' : 'ملفات معلمين'} معروضة بعد`}
            description={
              search || city || type || service
                ? 'جرّب كلمة أبسط أو امسح عوامل التصفية.'
                : 'العرض في الدليل اختياري، وسيظهر هنا من يفعّله.'
            }
          />
        ) : (
          <>
            {pagination && (
              <p className="mb-4 text-sm text-fg-muted">
                {formatNumber(pagination.total)} {pagination.total === 1 ? label : label === 'أكاديمية' ? 'أكاديمية' : 'معلماً'}
              </p>
            )}
            <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${status === 'loading' ? 'opacity-60 transition-opacity' : ''}`}>
              {items.map((item) =>
                kind === 'academies' ? (
                  <AcademyCard key={(item as DirectoryAcademy).slug} academy={item as DirectoryAcademy} />
                ) : (
                  <TeacherCard key={(item as DirectoryTeacher).id} teacher={item as DirectoryTeacher} />
                ),
              )}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button variant="secondary" size="lg" onClick={loadMore} isLoading={loadingMore}>
                  عرض المزيد
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

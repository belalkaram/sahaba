'use client';

import React, { useState } from 'react';
import { PlusIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { DataState } from '../../../components/ui/data-state';
import { PageHeader } from '../../../components/ui/page-header';
import { useCan } from '../../../hooks/useCan';
import { usePagedList } from '../../../hooks/use-paged-list';
import { assessmentApi } from '../../../lib/assessment-api';
import { assessmentOverviewApi, EMPTY_FILTERS, type AssignmentOverviewRow, type AssignmentOverviewSummary, type CourseOption } from '../../../lib/assessment-overview-api';
import { formatNumber } from '../../../lib/format';
import { describeCreateError } from '../../../features/assessment/create-exam-form';
import { AssignmentOverviewCard } from '../../../features/assessment/overview/assignment-overview-card';
import { AssignmentSubmissionsModal } from '../../../features/assessment/overview/assignment-submissions-modal';
import { CreateAssignmentForm } from '../../../features/assessment/overview/create-assignment-form';
import { OverviewFilters } from '../../../features/assessment/overview/overview-filters';
import { AssessmentTabs, KpiFilterButton } from '../../../features/assessment/overview/overview-parts';

const STATUS_OPTIONS = [
  { value: 'published', label: 'منشور' },
  { value: 'draft', label: 'مسودة' },
  { value: 'archived', label: 'مؤرشف' },
];
const NEEDS_OPTIONS = [
  { value: 'pending_grading', label: 'بانتظار التصحيح' },
  { value: 'open_now', label: 'موعده لم ينتهِ' },
  { value: 'past_due_missing', label: 'انتهى الموعد وفيه طلاب لم يسلّموا' },
  { value: 'no_submissions', label: 'منشور ولم يسلّمه أحد' },
  { value: 'late', label: 'فيه تسليمات متأخرة' },
  { value: 'grades_unpublished', label: 'درجات غير منشورة' },
];
const SORT_OPTIONS = [
  { value: '', label: 'الأحدث أولًا' },
  { value: 'due_soon', label: 'الأقرب موعدًا' },
  { value: 'oldest', label: 'الأقدم أولًا' },
  { value: 'pending', label: 'الأكثر انتظارًا للتصحيح' },
  { value: 'participation', label: 'الأكثر تسليمًا' },
  { value: 'title', label: 'حسب العنوان' },
];

export default function TeacherAssignmentsPage() {
  const canCreate = useCan('assignments.create');
  const canGrade = useCan('assignments.grade');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [summary, setSummary] = useState<AssignmentOverviewSummary | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [viewing, setViewing] = useState<AssignmentOverviewRow | null>(null);
  const [publishing, setPublishing] = useState<AssignmentOverviewRow | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const list = usePagedList<AssignmentOverviewRow>(async (page) => {
    const res = await assessmentOverviewApi.assignments(filters, page);
    setSummary(res.summary);
    setCourses(res.courses);
    return res;
  }, JSON.stringify(filters));

  const toggleNeeds = (needs: string) => setFilters((f) => ({ ...f, needs: f.needs === needs ? '' : needs }));
  const toggleStatus = (status: string) => setFilters((f) => ({ ...f, status: f.status === status ? '' : status }));

  const publishGrades = async () => {
    if (!publishing) return;
    try {
      setIsPublishing(true);
      await assessmentApi.bulkPublishGrades({ assignment_ids: [publishing.id] });
      setMessage({ type: 'success', text: `تم نشر درجات «${publishing.title}» للطلاب.` });
      list.retry();
    } catch (err) {
      setMessage({ type: 'error', text: describeCreateError(err, 'تعذّر نشر الدرجات.') });
    } finally {
      setIsPublishing(false);
      setPublishing(null);
    }
  };

  return (
    <div className="space-y-5 text-start">
      <PageHeader
        title="الواجبات"
        subtitle="تابع من هنا كل واجب: من سلّم، ومن تأخر، ومن لم يسلّم، وما ينتظر التصحيح."
        actions={
          canCreate ? (
            <Button onClick={() => setIsCreating((v) => !v)}>
              {isCreating ? 'إلغاء' : (
                <span className="inline-flex items-center gap-2">
                  <PlusIcon size={14} />
                  إنشاء واجب جديد
                </span>
              )}
            </Button>
          ) : undefined
        }
      />

      <AssessmentTabs />

      {message && (
        <p role="status" className={`rounded-md border p-3 text-xs font-semibold ${message.type === 'success' ? 'border-success/30 bg-success-subtle text-success' : 'border-danger/30 bg-danger-subtle text-danger'}`}>
          {message.text}
        </p>
      )}

      {isCreating && !list.loading && courses.length === 0 && (
        <DataState state="empty" message="لا يوجد لديك مقرر بعد، والواجب لازم يتبع مقررًا. أنشئ مقررًا أولًا من صفحة المقررات." />
      )}
      {isCreating && courses.length > 0 && (
        <CreateAssignmentForm
          courses={courses}
          onCancel={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            setMessage({ type: 'success', text: 'تم إنشاء ونشر الواجب بنجاح.' });
            list.retry();
          }}
        />
      )}

      <section aria-label="ملخص الواجبات" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiFilterButton label="كل الواجبات" value={summary?.total ?? null} />
        <KpiFilterButton label="منشورة" value={summary?.published ?? null} tone="success" active={filters.status === 'published'} onClick={() => toggleStatus('published')} />
        <KpiFilterButton label="انتهى موعدها وفيها نقص" value={summary?.past_due_missing ?? null} tone={summary?.past_due_missing ? 'danger' : 'neutral'} active={filters.needs === 'past_due_missing'} onClick={() => toggleNeeds('past_due_missing')} />
        <KpiFilterButton label="تسليمات متأخرة" value={summary?.late ?? null} tone={summary?.late ? 'warning' : 'neutral'} active={filters.needs === 'late'} onClick={() => toggleNeeds('late')} />
        <KpiFilterButton label="بانتظار التصحيح" value={summary?.pending_grading ?? null} tone={summary?.pending_grading ? 'warning' : 'neutral'} active={filters.needs === 'pending_grading'} onClick={() => toggleNeeds('pending_grading')} />
        <KpiFilterButton label="متوسط الدرجات" value={summary?.average_percent != null ? `${formatNumber(summary.average_percent, 1)}٪` : '—'} />
      </section>

      <OverviewFilters
        value={filters}
        onChange={setFilters}
        courses={courses}
        statusOptions={STATUS_OPTIONS}
        needsOptions={NEEDS_OPTIONS}
        sortOptions={SORT_OPTIONS}
        dateHint="آخر موعد أو تاريخ الإنشاء"
        searchPlaceholder="ابحث باسم الواجب أو المقرر..."
      />

      {list.error === 'forbidden' ? (
        <DataState state="forbidden" />
      ) : list.error ? (
        <DataState state="error" onRetry={list.retry} />
      ) : list.loading ? (
        <DataState state="loading" />
      ) : list.items.length === 0 ? (
        <DataState state="empty" message={Object.values(filters).some(Boolean) ? 'لا توجد واجبات تطابق هذه الفلاتر.' : 'لم يتم إنشاء أي واجب بعد.'} />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-fg-muted">{formatNumber(list.total)} واجب</p>
          {list.items.map((assignment) => (
            <AssignmentOverviewCard key={assignment.id} assignment={assignment} canEdit={canCreate} canGrade={canGrade} onOpenSubmissions={setViewing} onPublishGrades={setPublishing} />
          ))}
          {list.hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={list.loadMore} disabled={list.loadingMore}>
                {list.loadingMore ? 'جارٍ التحميل...' : 'عرض المزيد'}
              </Button>
            </div>
          )}
        </div>
      )}

      {viewing && <AssignmentSubmissionsModal assignment={viewing} onClose={() => setViewing(null)} onGraded={list.retry} />}

      <ConfirmDialog
        isOpen={publishing !== null}
        onClose={() => setPublishing(null)}
        onConfirm={publishGrades}
        title="نشر الدرجات للطلاب"
        description={`ستظهر درجات «${publishing?.title ?? ''}» للطلاب ويصلهم إشعار بذلك.`}
        confirmText="نشر الدرجات"
        isDestructive={false}
        isLoading={isPublishing}
      />
    </div>
  );
}

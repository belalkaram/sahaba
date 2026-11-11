'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { buttonClasses } from '../../../components/ui/button-styles';
import { formatDateTime, formatNumber } from '../../../lib/format';
import type { ExamOverviewRow } from '../../../lib/assessment-overview-api';
import { ParticipationBar, StatCell } from './overview-parts';

const STATUS: Record<ExamOverviewRow['status'], { label: string; variant: BadgeVariant }> = {
  draft: { label: 'مسودة', variant: 'neutral' },
  published: { label: 'منشور', variant: 'success' },
  closed: { label: 'مغلق', variant: 'warning' },
  completed: { label: 'منتهٍ', variant: 'warning' },
  archived: { label: 'مؤرشف', variant: 'neutral' },
};

interface ExamOverviewCardProps {
  exam: ExamOverviewRow;
  canEdit: boolean;
  canGrade: boolean;
  onPublishGrades: (exam: ExamOverviewRow) => void;
}

export function ExamOverviewCard({ exam, canEdit, canGrade, onPublishGrades }: ExamOverviewCardProps) {
  const { stats } = exam;
  const status = STATUS[exam.status] ?? STATUS.draft;
  const percent = (score: number | null) => (score !== null && exam.total_points ? `${formatNumber(score, 1)} / ${formatNumber(exam.total_points, 1)}` : score);
  const hasScores = stats.average_score !== null;
  const canPublishGrades = canGrade && !exam.is_grades_published && stats.graded > 0;

  return (
    <Card className="p-5 space-y-4 bg-surface border border-border shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {exam.course && <span className="font-mono text-xs font-bold text-primary">{exam.course.code}</span>}
            <Badge variant={status.variant}>{status.label}</Badge>
            {exam.is_open && <Badge variant="info">متاح الآن</Badge>}
            {exam.allow_split_sessions && <Badge variant="neutral">على جلسات</Badge>}
            {stats.graded > 0 && <Badge variant={exam.is_grades_published ? 'success' : 'warning'}>{exam.is_grades_published ? 'الدرجات منشورة' : 'الدرجات غير منشورة'}</Badge>}
          </div>
          <h3 className="text-base font-bold text-fg">{exam.title}</h3>
          <p className="text-xs text-fg-muted">
            {exam.course?.title} · {formatNumber(exam.questions_count)} سؤال · {formatNumber(exam.duration_minutes ?? 0)} دقيقة · {formatNumber(exam.total_points ?? 0, 1)} درجة
            {exam.passing_score !== null && ` · النجاح من ${formatNumber(exam.passing_score, 1)}`}
            {exam.max_attempts ? ` · ${formatNumber(exam.max_attempts)} محاولة` : ''}
          </p>
          <p className="text-xs text-fg-subtle">
            {exam.opens_at ? `يفتح ${formatDateTime(exam.opens_at)}` : 'بدون موعد فتح'} · {exam.closes_at ? `يغلق ${formatDateTime(exam.closes_at)}` : 'بدون موعد إغلاق'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canGrade && stats.pending_grading > 0 && (
            <Link href={`/teacher/grading?exam=${exam.id}`} className={buttonClasses('primary', 'sm')}>
              تصحيح {formatNumber(stats.pending_grading)}
            </Link>
          )}
          {canPublishGrades && (
            <button type="button" onClick={() => onPublishGrades(exam)} className={buttonClasses('secondary', 'sm')}>
              نشر الدرجات
            </button>
          )}
          {canEdit && (
            <Link href={`/teacher/courses/${exam.course_id}/exams/${exam.id}/builder`} className={buttonClasses('secondary', 'sm')}>
              الأسئلة والإعدادات
            </Link>
          )}
        </div>
      </div>

      {exam.questions_count === 0 && exam.status === 'draft' && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
          <AlertTriangle size={14} strokeWidth={1.75} aria-hidden />
          أضف سؤالًا واحدًا على الأقل حتى تتمكن من النشر.
        </p>
      )}

      <ParticipationBar
        total={stats.enrolled}
        segments={[
          { label: 'سلّموا', value: stats.completed, className: 'bg-success' },
          { label: 'يحلون الآن', value: stats.in_progress, className: 'bg-info' },
          { label: 'لم يدخلوا', value: stats.not_started, className: 'bg-border' },
        ]}
      />

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCell label="المسجلون" value={stats.enrolled} />
        <StatCell label="دخلوا" value={stats.started} />
        <StatCell label="لم يدخلوا" value={stats.not_started} />
        <StatCell label="يحلون الآن" value={stats.in_progress} tone={stats.in_progress > 0 ? 'info' : 'neutral'} />
        <StatCell label="سلّموا" value={stats.completed} tone={stats.completed > 0 ? 'success' : 'neutral'} />
        <StatCell label="انتهى وقتهم" value={stats.timed_out} tone={stats.timed_out > 0 ? 'warning' : 'neutral'} hint="بدأوا ولم يسلّموا حتى انتهى الوقت" />
        <StatCell label="بانتظار التصحيح" value={stats.pending_grading} tone={stats.pending_grading > 0 ? 'warning' : 'neutral'} />
        <StatCell label="تم تصحيحهم" value={stats.graded} hint="عدد المحاولات المصححة" />
        <StatCell label="المتوسط" value={hasScores ? percent(stats.average_score) : '—'} hint="أفضل محاولة لكل طالب" />
        <StatCell label="أعلى / أقل" value={hasScores ? `${formatNumber(stats.highest_score ?? 0, 1)} / ${formatNumber(stats.lowest_score ?? 0, 1)}` : '—'} />
        <StatCell label="نجحوا / رسبوا" value={exam.passing_score !== null && hasScores ? `${formatNumber(stats.passed)} / ${formatNumber(stats.failed)}` : '—'} hint={exam.passing_score === null ? 'لم تُحدَّد درجة نجاح لهذا الاختبار' : undefined} />
        <StatCell label="مخالفات" value={stats.violators} tone={stats.violators > 0 ? 'danger' : 'neutral'} hint="طلاب سُجلت عليهم مخالفات أثناء الاختبار" />
      </dl>
    </Card>
  );
}

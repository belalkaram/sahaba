'use client';

import React from 'react';
import Link from 'next/link';
import { Badge, type BadgeVariant } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { buttonClasses } from '../../../components/ui/button-styles';
import { formatDateTime, formatNumber } from '../../../lib/format';
import type { AssignmentOverviewRow } from '../../../lib/assessment-overview-api';
import { ParticipationBar, StatCell } from './overview-parts';

const STATUS: Record<AssignmentOverviewRow['status'], { label: string; variant: BadgeVariant }> = {
  draft: { label: 'مسودة', variant: 'neutral' },
  published: { label: 'منشور', variant: 'success' },
  archived: { label: 'مؤرشف', variant: 'neutral' },
};

interface AssignmentOverviewCardProps {
  assignment: AssignmentOverviewRow;
  canEdit: boolean;
  canGrade: boolean;
  onOpenSubmissions: (assignment: AssignmentOverviewRow) => void;
  onPublishGrades: (assignment: AssignmentOverviewRow) => void;
}

export function AssignmentOverviewCard({ assignment, canEdit, canGrade, onOpenSubmissions, onPublishGrades }: AssignmentOverviewCardProps) {
  const { stats } = assignment;
  const status = STATUS[assignment.status] ?? STATUS.draft;
  const hasScores = stats.average_score !== null;
  const unpublished = stats.graded - stats.grades_published;
  const onTime = Math.max(0, stats.submitted - stats.late);

  return (
    <Card className="p-5 space-y-4 bg-surface border border-border shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {assignment.course && <span className="font-mono text-xs font-bold text-primary">{assignment.course.code}</span>}
            <Badge variant={status.variant}>{status.label}</Badge>
            {assignment.is_past_due && <Badge variant="warning">انتهى الموعد</Badge>}
            {assignment.allow_late && <Badge variant="neutral">يقبل التأخير</Badge>}
            {assignment.allow_resubmission && <Badge variant="neutral">يقبل إعادة التسليم</Badge>}
          </div>
          <h3 className="text-base font-bold text-fg">{assignment.title}</h3>
          <p className="text-xs text-fg-muted">
            {assignment.course?.title} · {formatNumber(assignment.points_possible ?? 0, 1)} درجة · {assignment.questions_count > 0 ? `${formatNumber(assignment.questions_count)} سؤال` : 'بدون أسئلة (تسليم نص أو ملف)'}
            {assignment.late_penalty_percent > 0 && ` · خصم التأخير ${formatNumber(assignment.late_penalty_percent)}٪`}
          </p>
          <p className="text-xs text-fg-subtle">{assignment.due_at ? `آخر موعد ${formatDateTime(assignment.due_at)}` : 'بدون موعد نهائي'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canGrade && stats.pending_grading > 0 && (
            <Link href={`/teacher/grading?assignment=${assignment.id}`} className={buttonClasses('primary', 'sm')}>
              تصحيح {formatNumber(stats.pending_grading)}
            </Link>
          )}
          {canGrade && unpublished > 0 && (
            <button type="button" onClick={() => onPublishGrades(assignment)} className={buttonClasses('secondary', 'sm')}>
              نشر الدرجات
            </button>
          )}
          {canGrade && (
            <button type="button" onClick={() => onOpenSubmissions(assignment)} className={buttonClasses('secondary', 'sm')}>
              التسليمات
            </button>
          )}
          {canEdit && (
            <Link href={`/teacher/courses/${assignment.course_id}/assignments/${assignment.id}`} className={buttonClasses('secondary', 'sm')}>
              الأسئلة والحل النموذجي
            </Link>
          )}
        </div>
      </div>

      <ParticipationBar
        total={stats.enrolled}
        segments={[
          { label: 'في الموعد', value: onTime, className: 'bg-success' },
          { label: 'متأخر', value: stats.late, className: 'bg-warning' },
          { label: 'لم يسلّموا', value: stats.not_submitted, className: 'bg-border' },
        ]}
      />

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <StatCell label="المسجلون" value={stats.enrolled} />
        <StatCell label="سلّموا" value={stats.submitted} tone={stats.submitted > 0 ? 'success' : 'neutral'} />
        <StatCell label="لم يسلّموا" value={stats.not_submitted} tone={assignment.is_past_due && stats.not_submitted > 0 ? 'danger' : 'neutral'} />
        <StatCell label="تسليم متأخر" value={stats.late} tone={stats.late > 0 ? 'warning' : 'neutral'} />
        <StatCell label="مرفق ملف" value={stats.with_file} />
        <StatCell label="بانتظار التصحيح" value={stats.pending_grading} tone={stats.pending_grading > 0 ? 'warning' : 'neutral'} />
        <StatCell label="تم تصحيحهم" value={stats.graded} />
        <StatCell label="درجات منشورة" value={stats.grades_published} />
        <StatCell label="المتوسط" value={hasScores ? `${formatNumber(stats.average_score ?? 0, 1)} / ${formatNumber(assignment.points_possible ?? 0, 1)}` : '—'} hint="أفضل تسليم لكل طالب" />
        <StatCell label="أعلى / أقل" value={hasScores ? `${formatNumber(stats.highest_score ?? 0, 1)} / ${formatNumber(stats.lowest_score ?? 0, 1)}` : '—'} />
      </dl>
    </Card>
  );
}

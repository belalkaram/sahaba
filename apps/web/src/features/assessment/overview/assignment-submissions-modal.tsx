'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { assessmentApi } from '../../../lib/assessment-api';
import type { AssignmentOverviewRow } from '../../../lib/assessment-overview-api';
import type { AssignmentSubmission } from '../../../types';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { DataState } from '../../../components/ui/data-state';
import { buttonClasses } from '../../../components/ui/button-styles';
import { formatDateTime, formatNumber } from '../../../lib/format';
import { describeCreateError } from '../create-exam-form';

const FIELD = 'w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary';

interface AssignmentSubmissionsModalProps {
  assignment: AssignmentOverviewRow;
  onClose: () => void;
  /** A grade changed, so the counters on the page are out of date. */
  onGraded: () => void;
}

/** Everyone who submitted one assignment, graded or not. The grading inbox lists only what is still pending. */
export function AssignmentSubmissionsModal({ assignment, onClose, onGraded }: AssignmentSubmissionsModalProps) {
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [active, setActive] = useState<AssignmentSubmission | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      setSubmissions(await assessmentApi.getAssignmentSubmissions(assignment.course_id, assignment.id));
      setState('ready');
    } catch {
      setState('error');
    }
  }, [assignment.course_id, assignment.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (sub: AssignmentSubmission) => {
    setActive(sub);
    setScore(sub.score ?? 0);
    setFeedback(sub.feedback ?? '');
    setPublish(true);
    setError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    try {
      setSaving(true);
      setError(null);
      await assessmentApi.gradeSubmission(assignment.course_id, assignment.id, active.id, score, feedback.trim() || undefined, publish);
      setActive(null);
      onGraded();
      await load();
    } catch (err) {
      setError(describeCreateError(err, 'تعذّر حفظ الدرجة.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="xl" title={`تسليمات: ${assignment.title}`} subtitle={`الدرجة العظمى ${formatNumber(assignment.points_possible ?? 0, 1)}`}>
      {active ? (
        <form onSubmit={save} className="space-y-4 text-xs">
          <h4 className="text-sm font-bold text-fg">{active.student?.user?.name || 'طالب'}</h4>
          <div className="rounded-md border border-border bg-surface-muted p-3 text-fg whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
            {active.content || 'لا يوجد نص مرفق.'}
          </div>
          {active.file_name && (
            <a href={assessmentApi.getSubmissionFileDownloadUrl(assignment.course_id, assignment.id, active.id)} target="_blank" rel="noreferrer" className={buttonClasses('secondary', 'sm')}>
              تحميل الملف: {active.file_name}
            </a>
          )}
          <div>
            <label className="block font-semibold text-fg-muted mb-1">الدرجة (من {formatNumber(assignment.points_possible ?? 0, 1)})</label>
            <input aria-label="الدرجة" type="number" required min={0} max={assignment.points_possible ?? undefined} step={0.5} value={score} onChange={(e) => setScore(Number(e.target.value))} className={`${FIELD} font-mono`} />
          </div>
          <div>
            <label className="block font-semibold text-fg-muted mb-1">ملاحظات للطالب (اختياري)</label>
            <textarea aria-label="ملاحظات للطالب" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={FIELD} />
          </div>
          <label className="flex items-center gap-2 font-medium text-fg cursor-pointer w-fit">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="rounded-xs" />
            نشر الدرجة للطالب فور الحفظ
          </label>
          {error && (
            <p role="alert" className="font-semibold text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setActive(null)} className={buttonClasses('secondary', 'sm')}>
              رجوع للتسليمات
            </button>
            <button type="submit" disabled={saving} className={buttonClasses('primary', 'sm')}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ الدرجة'}
            </button>
          </div>
        </form>
      ) : state === 'loading' ? (
        <DataState state="loading" />
      ) : state === 'error' ? (
        <DataState state="error" onRetry={() => void load()} />
      ) : submissions.length === 0 ? (
        <DataState state="empty" message="لم يسلّم أي طالب هذا الواجب حتى الآن." />
      ) : (
        <ul className="space-y-2">
          {submissions.map((sub) => (
            <li key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-fg">{sub.student?.user?.name || 'طالب'}</span>
                  {sub.is_late && <Badge variant="warning">متأخر</Badge>}
                  {sub.status === 'graded' ? <Badge variant="success">تم التصحيح</Badge> : <Badge variant="info">بانتظار التصحيح</Badge>}
                </div>
                <p className="text-xs text-fg-muted">
                  {sub.submitted_at ? formatDateTime(sub.submitted_at) : '—'}
                  {sub.score !== null && sub.score !== undefined && ` · الدرجة ${formatNumber(Number(sub.score), 1)}`}
                </p>
              </div>
              <button type="button" onClick={() => open(sub)} className={buttonClasses(sub.status === 'graded' ? 'secondary' : 'primary', 'sm')}>
                {sub.status === 'graded' ? 'تعديل الدرجة' : 'عرض وتصحيح'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

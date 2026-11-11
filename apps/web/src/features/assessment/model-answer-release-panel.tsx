'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { assessmentApi, type AssessmentKind, type ReleaseTarget } from '../../lib/assessment-api';
import { attendanceApi } from '../../lib/attendance-api';
import { ApiError } from '../../lib/api-client';
import type { ModelAnswerStudentRow, SchoolClass } from '../../types';
import { buttonClasses } from '../../components/ui/button-styles';
import { Badge } from '../../components/ui/badge';
import { formatNumber } from '../../lib/format';

/**
 * Teacher: decide who may see the model answers. A student appears here once they finished the work; the
 * model answer only opens for them after grades are published AND the teacher released it (for the student,
 * a whole class, or everyone) - or automatically once the window closes, if that option is on.
 */
export function ModelAnswerReleasePanel({ courseId, kind, itemId }: { courseId: string; kind: AssessmentKind; itemId: string }) {
  const [rows, setRows] = useState<ModelAnswerStudentRow[]>([]);
  const [auto, setAuto] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const status = await assessmentApi.getModelAnswerStatus(courseId, kind, itemId);
      setRows(status.students);
      setAuto(status.auto_release);
    } catch {
      setMsg({ type: 'error', text: 'تعذّر تحميل حالة الحل النموذجي.' });
    } finally {
      setLoading(false);
    }
  }, [courseId, kind, itemId]);

  useEffect(() => {
    void load();
    attendanceApi.getClasses().then(setClasses).catch(() => setClasses([]));
  }, [load]);

  const finished = useMemo(() => rows.filter((r) => r.finished), [rows]);
  const waitingGrades = finished.filter((r) => !r.graded).length;

  const run = async (action: 'release' | 'revoke', target: ReleaseTarget, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      if (action === 'release') await assessmentApi.releaseModelAnswers(courseId, kind, itemId, target);
      else await assessmentApi.revokeModelAnswers(courseId, kind, itemId, target);
      setMsg({ type: 'success', text: done });
      setSelected(new Set());
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof ApiError ? err.message : 'تعذّر تنفيذ العملية.' });
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    setAuto(enabled);
    try {
      await assessmentApi.setModelAnswerAutoRelease(courseId, kind, itemId, enabled);
    } catch {
      setAuto(!enabled);
      setMsg({ type: 'error', text: 'تعذّر تغيير الإتاحة التلقائية.' });
    }
  };

  const ids = Array.from(selected);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5 text-xs" aria-labelledby="release-title">
      <div>
        <h3 id="release-title" className="text-sm font-bold text-fg">
          إتاحة الحل النموذجي للطلبة
        </h3>
        <p className="mt-1 text-fg-muted">
          يرى الطالب الحل بعد أن يُسلّم عمله وتنشر أنت الدرجات وتُتيح له الحل. {waitingGrades > 0 && `(${formatNumber(waitingGrades)} طالب سلّم وينتظر نشر الدرجات)`}
        </p>
      </div>

      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={auto} onChange={(e) => void toggleAuto(e.target.checked)} />
        إتاحة تلقائية لمن أنهى وصُحّح عمله بعد انتهاء فترة {kind === 'exams' ? 'الاختبار' : 'تسليم الواجب'}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void run('release', { scope: 'all' }, 'أُتيح الحل النموذجي لجميع الطلبة المستوفين للشروط.')} className={buttonClasses('primary', 'sm')}>
          إتاحة للجميع
        </button>
        <button type="button" disabled={busy} onClick={() => void run('revoke', { scope: 'all' }, 'سُحبت الإتاحة العامة.')} className={buttonClasses('secondary', 'sm')}>
          سحب الإتاحة العامة
        </button>
        {classes.length > 0 && (
          <span className="flex items-center gap-2">
            <select aria-label="اختيار فصل" value={classId} onChange={(e) => setClassId(e.target.value)} className="h-8 rounded-sm border border-border bg-surface px-2">
              <option value="">اختر فصلًا / مجموعة…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" disabled={busy || !classId} onClick={() => void run('release', { scope: 'class', class_id: classId }, 'أُتيح الحل النموذجي لطلبة الفصل.')} className={buttonClasses('secondary', 'sm')}>
              إتاحة للفصل
            </button>
            <button type="button" disabled={busy || !classId} onClick={() => void run('revoke', { scope: 'class', class_id: classId }, 'سُحبت الإتاحة عن الفصل.')} className={buttonClasses('ghost', 'sm')}>
              سحب
            </button>
          </span>
        )}
      </div>

      {msg && (
        <p role={msg.type === 'error' ? 'alert' : 'status'} className={msg.type === 'error' ? 'font-semibold text-danger' : 'font-semibold text-success'}>
          {msg.text}
        </p>
      )}

      {loading ? (
        <p className="text-fg-muted">جارٍ التحميل…</p>
      ) : rows.length === 0 ? (
        <p className="text-fg-muted">لا يوجد طلبة مسجَّلون في هذا المقرر.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || ids.length === 0} onClick={() => void run('release', { scope: 'student', student_ids: ids }, `أُتيح الحل لـ ${formatNumber(ids.length)} طالب.`)} className={buttonClasses('primary', 'sm')}>
              إتاحة للمحدَّدين ({formatNumber(ids.length)})
            </button>
            <button type="button" disabled={busy || ids.length === 0} onClick={() => void run('revoke', { scope: 'student', student_ids: ids }, 'سُحبت الإتاحة عن المحدَّدين.')} className={buttonClasses('ghost', 'sm')}>
              سحب عن المحدَّدين
            </button>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((r) => (
              <li key={r.student_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <label className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.student_id)}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(r.student_id);
                        else next.delete(r.student_id);
                        return next;
                      })
                    }
                  />
                  <span className="truncate font-medium text-fg">{r.name ?? r.student_id}</span>
                </label>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Badge variant={r.finished ? 'success' : 'neutral'}>{r.finished ? 'سلّم' : 'لم يسلّم'}</Badge>
                  {r.finished && <Badge variant={r.graded ? 'success' : 'warning'}>{r.graded ? 'درجته منشورة' : 'بانتظار الدرجات'}</Badge>}
                  <Badge variant={r.can_view ? 'info' : 'neutral'}>{r.can_view ? 'يرى الحل' : 'لا يرى الحل'}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

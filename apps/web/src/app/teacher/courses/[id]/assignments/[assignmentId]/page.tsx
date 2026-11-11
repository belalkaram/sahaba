'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { assessmentApi, type CreateQuestionPayload } from '../../../../../../lib/assessment-api';
import { ApiError } from '../../../../../../lib/api-client';
import type { Assignment, AssignmentQuestion } from '../../../../../../types';
import { PageHeader } from '../../../../../../components/ui/page-header';
import { Card } from '../../../../../../components/ui/card';
import { Badge } from '../../../../../../components/ui/badge';
import { buttonClasses } from '../../../../../../components/ui/button-styles';
import { formatNumber } from '../../../../../../lib/format';
import { QuestionImage } from '../../../../../../components/assessment/question-image';
import { QuestionMediaFields, EMPTY_MEDIA_CHANGES, applyMediaChanges, hasMediaChanges, type MediaChanges } from '../../../../../../features/assessment/question-media-fields';
import { ModelAnswerReleasePanel } from '../../../../../../features/assessment/model-answer-release-panel';

type QType = CreateQuestionPayload['question_type'];

const TYPE_LABELS: Record<QType, string> = {
  multiple_choice: 'اختيار من متعدد',
  multiple_select: 'اختيار إجابات متعددة',
  true_false: 'صح / خطأ',
  short_answer: 'إجابة قصيرة',
  essay: 'سؤال مقالي',
};

/**
 * Teacher: the questions of an assignment (same types and optional images as exam questions) and the
 * release of its model answers. Assignments without questions keep working as free-text / file submissions.
 */
export default function TeacherAssignmentPage({ params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const { id: courseId, assignmentId } = use(params);

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<AssignmentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editing, setEditing] = useState<AssignmentQuestion | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [type, setType] = useState<QType>('multiple_choice');
  const [points, setPoints] = useState(5);
  const [options, setOptions] = useState<string[]>(['الخيار الأول', 'الخيار الثاني']);
  const [correct, setCorrect] = useState('');
  const [acceptable, setAcceptable] = useState('');
  const [explanation, setExplanation] = useState('');
  const [modelAnswer, setModelAnswer] = useState('');
  const [media, setMedia] = useState<MediaChanges>(EMPTY_MEDIA_CHANGES);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, q] = await Promise.all([assessmentApi.getAssignment(courseId, assignmentId), assessmentApi.getAssignmentQuestions(courseId, assignmentId, true)]);
      setAssignment(a.assignment);
      setQuestions(q);
    } catch {
      setFeedback({ type: 'error', text: 'تعذّر تحميل الواجب.' });
    } finally {
      setLoading(false);
    }
  }, [courseId, assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openForm = (q: AssignmentQuestion | null) => {
    setEditing(q);
    setText(q?.question_text ?? '');
    setType(q?.question_type ?? 'multiple_choice');
    setPoints(q?.points ?? 5);
    setOptions(q?.options && q.options.length > 0 ? q.options : ['الخيار الأول', 'الخيار الثاني']);
    setCorrect(q?.correct_answer ?? '');
    setAcceptable(q?.acceptable_answers?.join(', ') ?? '');
    setExplanation(q?.explanation ?? '');
    setModelAnswer(q?.model_answer ?? '');
    setMedia(EMPTY_MEDIA_CHANGES);
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    const payload: CreateQuestionPayload = {
      question_text: text,
      question_type: type,
      points,
      options: type === 'multiple_choice' || type === 'multiple_select' ? options.filter((o) => o.trim()) : undefined,
      correct_answer: ['multiple_choice', 'true_false', 'short_answer'].includes(type) ? correct || undefined : undefined,
      acceptable_answers: acceptable ? acceptable.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      explanation: explanation || undefined,
      model_answer: modelAnswer || undefined,
    };
    try {
      const saved = editing
        ? await assessmentApi.updateAssignmentQuestion(courseId, assignmentId, editing.id, { ...payload, model_answer: modelAnswer })
        : await assessmentApi.addAssignmentQuestion(courseId, assignmentId, payload);
      if (hasMediaChanges(media)) {
        try {
          await applyMediaChanges(courseId, 'assignments', assignmentId, saved.id, media);
        } catch {
          setFeedback({ type: 'error', text: 'حُفظ السؤال لكن تعذّر رفع الصورة. افتح السؤال وأعد المحاولة.' });
        }
      }
      setOpen(false);
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof ApiError ? err.message : 'فشل حفظ السؤال.' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q: AssignmentQuestion) => {
    if (!confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    try {
      await assessmentApi.deleteAssignmentQuestion(courseId, assignmentId, q.id);
      await load();
    } catch {
      setFeedback({ type: 'error', text: 'فشل حذف السؤال.' });
    }
  };

  if (loading) return <p className="py-16 text-center text-sm text-fg-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title={assignment?.title ?? 'الواجب'}
        subtitle="أسئلة الواجب (اختيارية: يمكن للواجب أن يبقى تسليم نص أو ملف). تُصحَّح الأسئلة الموضوعية تلقائيًا ويراجع المعلم المقالية."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="info">{formatNumber(questions.length)} سؤال</Badge>
            <Link href="/teacher/assignments" className={buttonClasses('secondary', 'md')}>
              رجوع
            </Link>
          </div>
        }
      />

      {feedback && (
        <p role={feedback.type === 'error' ? 'alert' : 'status'} className={feedback.type === 'error' ? 'rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm font-semibold text-danger-subtle-fg' : 'rounded-md border border-success/30 bg-success-subtle p-3 text-sm font-semibold text-success'}>
          {feedback.text}
        </p>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => openForm(null)} className={buttonClasses('primary', 'md')}>
          إضافة سؤال
        </button>
      </div>

      {questions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-fg-muted">لا توجد أسئلة بعد. أضف أسئلة لتصبح إجابة الواجب داخل المنصة، أو اتركه بدونها ليسلّم الطلبة نصًا أو ملفًا.</Card>
      ) : (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <Card key={q.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-line break-words font-bold text-fg">
                  {formatNumber(i + 1)}. {q.question_text}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="neutral">{TYPE_LABELS[q.question_type]}</Badge>
                  <span className="text-xs font-semibold text-fg-muted">{formatNumber(Number(q.points))} درجة</span>
                </div>
              </div>
              {q.has_image && <QuestionImage courseId={courseId} kind="assignments" itemId={assignmentId} questionId={q.id} />}
              {q.options && q.options.length > 0 && (
                <ul className="list-disc ps-5 text-sm text-fg-muted">
                  {q.options.map((o) => (
                    <li key={o} className={o === q.correct_answer ? 'font-bold text-success' : ''}>
                      {o}
                    </li>
                  ))}
                </ul>
              )}
              {q.model_answer && <p className="rounded-md bg-primary-subtle p-2 text-xs text-primary-subtle-fg">الحل النموذجي: {q.model_answer}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => openForm(q)} className={buttonClasses('secondary', 'sm')}>
                  تعديل
                </button>
                <button type="button" onClick={() => void remove(q)} className={buttonClasses('ghost', 'sm')}>
                  حذف
                </button>
              </div>
            </Card>
          ))}
        </ol>
      )}

      <ModelAnswerReleasePanel courseId={courseId} kind="assignments" itemId={assignmentId} />

      {open && (
        <div role="dialog" aria-modal="true" aria-label="سؤال" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto p-6">
            <h3 className="text-base font-black text-fg">{editing ? 'تعديل السؤال' : 'سؤال جديد'}</h3>
            <form onSubmit={save} className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-bold text-secondary">نص السؤال</label>
                <textarea aria-label="نص السؤال" rows={3} value={text} onChange={(e) => setText(e.target.value)} required className="w-full rounded-md border border-border bg-background p-2.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-secondary">نوع السؤال</label>
                  <select aria-label="نوع السؤال" value={type} onChange={(e) => setType(e.target.value as QType)} className="w-full rounded-md border border-border bg-surface px-3 py-2">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-secondary">الدرجة</label>
                  <input aria-label="الدرجة" type="number" min={0} step="0.5" value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-full rounded-md border border-border bg-background px-3 py-2" />
                </div>
              </div>

              {(type === 'multiple_choice' || type === 'multiple_select') && (
                <div className="space-y-2">
                  <label className="block font-bold text-secondary">الخيارات</label>
                  {options.map((o, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input aria-label={`الخيار ${idx + 1}`} value={o} onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === idx ? e.target.value : x)))} className="flex-1 rounded-md border border-border bg-background px-3 py-2" />
                      <button type="button" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== idx))} disabled={options.length <= 2} className={buttonClasses('ghost', 'sm')}>
                        حذف
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setOptions((prev) => [...prev, `خيار ${prev.length + 1}`])} className={buttonClasses('secondary', 'sm')}>
                    إضافة خيار
                  </button>
                </div>
              )}

              {type === 'multiple_choice' && (
                <div>
                  <label className="mb-1 block font-bold text-secondary">الإجابة الصحيحة</label>
                  <select aria-label="الإجابة الصحيحة" value={correct} onChange={(e) => setCorrect(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2">
                    <option value="">— اختر —</option>
                    {options.filter((o) => o.trim()).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {type === 'true_false' && (
                <div>
                  <label className="mb-1 block font-bold text-secondary">الإجابة الصحيحة</label>
                  <select aria-label="الإجابة الصحيحة" value={correct} onChange={(e) => setCorrect(e.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2">
                    <option value="">— اختر —</option>
                    <option value="true">صح</option>
                    <option value="false">خطأ</option>
                  </select>
                </div>
              )}
              {type === 'short_answer' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-bold text-secondary">الإجابة الصحيحة</label>
                    <input aria-label="الإجابة الصحيحة" value={correct} onChange={(e) => setCorrect(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-secondary">إجابات مقبولة أخرى (مفصولة بفاصلة)</label>
                    <input aria-label="إجابات مقبولة أخرى" value={acceptable} onChange={(e) => setAcceptable(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" />
                  </div>
                </div>
              )}
              {type === 'essay' && <p className="rounded-md bg-surface-muted p-2 text-fg-muted">السؤال المقالي تصحّحه أنت يدويًا بعد التسليم.</p>}

              <div>
                <label className="mb-1 block font-bold text-secondary">الحل النموذجي (يظهر للطالب فقط عندما تتيحه له)</label>
                <textarea aria-label="الحل النموذجي" rows={3} value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} className="w-full rounded-md border border-border bg-background p-2.5" />
              </div>
              <div>
                <label className="mb-1 block font-bold text-secondary">تفسير الإجابة (اختياري)</label>
                <textarea aria-label="تفسير الإجابة" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full rounded-md border border-border bg-background p-2.5" />
              </div>

              <QuestionMediaFields value={media} onChange={setMedia} hasImage={Boolean(editing?.has_image)} hasModelImage={Boolean(editing?.has_model_answer_image)} />

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button type="button" onClick={() => setOpen(false)} disabled={saving} className={buttonClasses('secondary', 'md')}>
                  إلغاء
                </button>
                <button type="submit" disabled={saving} className={buttonClasses('primary', 'md')}>
                  {saving ? 'جارٍ الحفظ…' : 'حفظ السؤال'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

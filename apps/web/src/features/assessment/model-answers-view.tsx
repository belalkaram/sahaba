'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Lock, XCircle } from 'lucide-react';
import { assessmentApi, type AssessmentKind } from '../../lib/assessment-api';
import { ApiError } from '../../lib/api-client';
import type { ModelAnswerItem } from '../../types';
import { QuestionImage } from '../../components/assessment/question-image';
import { buttonClasses } from '../../components/ui/button-styles';
import { formatNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

const LOCKED_COPY: Record<string, { title: string; body: string }> = {
  NOT_FINISHED: { title: 'أنهِ العمل أولًا', body: 'يظهر الحل النموذجي بعد أن تُسلّم الاختبار أو الواجب.' },
  GRADES_NOT_PUBLISHED: { title: 'بانتظار التصحيح', body: 'يظهر الحل النموذجي بعد أن ينتهي المعلم من التصحيح وينشر الدرجات.' },
  NOT_RELEASED: { title: 'لم يُتح الحل بعد', body: 'سيتيح لك المعلم الحل النموذجي في الوقت المناسب. ستجده هنا عند إتاحته.' },
};

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; title: string; items: ModelAnswerItem[] }
  | { phase: 'locked'; reason: string }
  | { phase: 'error' };

/** Student view: each question with the model answer next to the student's own answer. */
export function ModelAnswersView({ courseId, kind, itemId }: { courseId: string; kind: AssessmentKind; itemId: string }) {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    assessmentApi
      .getModelAnswers(courseId, kind, itemId)
      .then((res) => !cancelled && setState({ phase: 'ready', title: res.title, items: res.questions }))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          const reason = (err.details as { reason?: string } | undefined)?.reason ?? 'NOT_RELEASED';
          setState({ phase: 'locked', reason });
        } else {
          setState({ phase: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, kind, itemId]);

  if (state.phase === 'loading') return <p className="py-16 text-center text-sm text-fg-muted">جارٍ التحميل…</p>;
  if (state.phase === 'error') return <p role="alert" className="py-16 text-center text-sm text-danger">تعذّر تحميل الحل النموذجي. حاول مرة أخرى لاحقًا.</p>;
  if (state.phase === 'locked') {
    const copy = LOCKED_COPY[state.reason] ?? LOCKED_COPY.NOT_RELEASED;
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-border bg-surface p-8 text-center">
        <Lock className="mx-auto text-fg-muted" size={32} aria-hidden />
        <h2 className="text-lg font-bold text-fg">{copy.title}</h2>
        <p className="text-sm text-fg-muted">{copy.body}</p>
        <Link href={kind === 'exams' ? '/student/exams' : '/student/assignments'} className={buttonClasses('secondary', 'md')}>
          رجوع
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-start">
      <h2 className="text-xl font-bold text-fg">{state.title} — الحل النموذجي</h2>
      {state.items.map((it, i) => (
        <section key={it.question_id} className="space-y-3 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="whitespace-pre-line break-words font-bold text-fg">
              {formatNumber(i + 1)}. {it.question_text}
            </p>
            <span className="shrink-0 text-xs font-semibold text-fg-muted">
              {it.awarded_points != null ? `${formatNumber(Number(it.awarded_points))} / ` : ''}
              {formatNumber(Number(it.points))}
            </span>
          </div>
          {it.has_image && <QuestionImage courseId={courseId} kind={kind} itemId={itemId} questionId={it.question_id} />}

          <div
            className={cn(
              'rounded-lg border p-3 text-sm',
              it.is_correct === true ? 'border-success/40 bg-success-subtle' : it.is_correct === false ? 'border-danger/40 bg-danger-subtle' : 'border-border bg-surface-muted',
            )}
          >
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-fg">
              {it.is_correct === true && <CheckCircle2 size={16} className="text-success" aria-hidden />}
              {it.is_correct === false && <XCircle size={16} className="text-danger" aria-hidden />}
              إجابتك
            </p>
            <p className="whitespace-pre-line break-words text-fg">{it.student_answer || (it.selected_options?.length ? it.selected_options.join('، ') : 'لم تجب عن هذا السؤال')}</p>
            {it.feedback && <p className="mt-2 text-fg-muted">ملاحظة المعلم: {it.feedback}</p>}
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary-subtle p-3 text-sm text-primary-subtle-fg">
            <p className="mb-1 font-semibold">الحل النموذجي</p>
            {it.correct_answer && (
              <p className="break-words">
                الإجابة الصحيحة: <strong>{it.correct_answer}</strong>
              </p>
            )}
            {it.model_answer && <p className="mt-1 whitespace-pre-line break-words">{it.model_answer}</p>}
            {it.explanation && <p className="mt-1 break-words text-fg-muted">{it.explanation}</p>}
            {it.has_model_answer_image && (
              <div className="mt-2">
                <QuestionImage courseId={courseId} kind={kind} itemId={itemId} questionId={it.question_id} variant="model_answer" alt="صورة الحل النموذجي" />
              </div>
            )}
            {!it.correct_answer && !it.model_answer && !it.explanation && !it.has_model_answer_image && <p>لم يضف المعلم حلًّا نموذجيًا لهذا السؤال.</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flag, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { assessmentApi, type ActiveExamAttempt, type IntegrityEventType } from '../../lib/assessment-api';
import { useAuth } from '../../context/auth-context';
import { formatNumber } from '../../lib/format';
import { cn } from '../../lib/cn';
import { buttonClasses } from '../../components/ui/button-styles';
import { QuestionView, isAnswered, type AnswerValue } from './question-view';
import { useExamLockdown } from './use-exam-lockdown';
import { Watermark } from './watermark';

export type FinishReason = 'submitted' | 'time_up' | 'violations';

interface Props {
  courseId: string;
  examId: string;
  initial: ActiveExamAttempt;
  onFinished: (attemptId: string, reason: FinishReason) => void;
  /** Split-session exams: leave now and continue later (the saved answers and the remaining time are kept). */
  onPause?: () => void;
}

const clock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h > 0 ? `${String(h).padStart(2, '0')}:` : ''}${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function ExamSession({ courseId, examId, initial, onFinished, onPause }: Props) {
  const { user } = useAuth();
  const attemptId = initial.attempt.id;
  const questions = initial.questions;

  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    const map: Record<string, AnswerValue> = {};
    initial.attempt.answers?.forEach((a) => {
      map[a.question_id] = { answer_text: a.answer_text ?? undefined, selected_options: (a as { selected_options?: string[] }).selected_options ?? undefined };
    });
    return map;
  });

  // ---- Timer: monotonic clock anchored to the server's remaining seconds -------------------
  const endAt = useRef(0);
  useEffect(() => {
    endAt.current = performance.now() + initial.remaining_seconds * 1000;
    // Anchored once per mounted attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [remaining, setRemaining] = useState(initial.remaining_seconds);
  const finished = useRef(false);
  const retryFinish = useRef<(reason: FinishReason) => void>(() => {});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---- Answer persistence with an offline queue --------------------------------------------
  const pending = useRef<Map<string, AnswerValue>>(new Map());
  const [online, setOnline] = useState(true);
  const [unsaved, setUnsaved] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const flush = useCallback(async () => {
    for (const [qId, value] of Array.from(pending.current.entries())) {
      try {
        await assessmentApi.submitExamAnswer(courseId, examId, attemptId, { question_id: qId, answer_text: value.answer_text, selected_options: value.selected_options });
        if (pending.current.get(qId) === value) pending.current.delete(qId);
        setOnline(true);
        setSavedAt(new Date());
      } catch {
        setOnline(false);
        break;
      }
    }
    setUnsaved(pending.current.size);
  }, [courseId, examId, attemptId]);

  const commit = useCallback(
    (qId: string, value: AnswerValue) => {
      pending.current.set(qId, value);
      setUnsaved(pending.current.size);
      void flush();
    },
    [flush],
  );

  useEffect(() => {
    const id = window.setInterval(() => pending.current.size > 0 && void flush(), 8000);
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, [flush]);

  // ---- Finishing ---------------------------------------------------------------------------
  const finish = useCallback(
    async (reason: FinishReason) => {
      if (finished.current) return;
      finished.current = true;
      setSubmitting(true);
      try {
        await flush();
        await assessmentApi.submitExam(courseId, examId, attemptId);
        onFinished(attemptId, reason);
      } catch {
        finished.current = false;
        setSubmitting(false);
        setSubmitError('تعذّر تسليم الاختبار. تحقق من الاتصال وحاول مرة أخرى؛ الوقت ما زال يُحتسب.');
        if (reason !== 'submitted') window.setTimeout(() => retryFinish.current(reason), 4000);
      }
    },
    [attemptId, courseId, examId, flush, onFinished],
  );

  useEffect(() => {
    retryFinish.current = (reason) => void finish(reason);
  }, [finish]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const left = (endAt.current - performance.now()) / 1000;
      setRemaining(left);
      if (left <= 0) void finish('time_up');
    }, 500);
    // Re-anchor to the server every 30s so the display cannot drift.
    const sync = window.setInterval(async () => {
      try {
        const res = await assessmentApi.getAttempt(courseId, examId, attemptId);
        endAt.current = performance.now() + res.remaining_seconds * 1000;
        if (res.attempt.status !== 'in_progress' && !finished.current) {
          finished.current = true;
          onFinished(attemptId, 'violations');
        }
      } catch {
        // keep the local countdown
      }
    }, 30000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sync);
    };
  }, [attemptId, courseId, examId, finish, onFinished]);

  // ---- Split-session heartbeat -------------------------------------------------------------
  // The server counts only ACTIVE time: this page tells it every 15 s that it is open, and gets the
  // authoritative remaining time back. The first beat of a sitting is flagged so the time away is not charged.
  const splitSessions = Boolean(initial.split_sessions);
  const firstBeat = useRef(true);
  const [pausing, setPausing] = useState(false);
  useEffect(() => {
    if (!splitSessions) return;
    const beat = async () => {
      try {
        const res = await assessmentApi.heartbeat(courseId, examId, attemptId, firstBeat.current);
        firstBeat.current = false;
        endAt.current = performance.now() + res.remaining_seconds * 1000;
        if (res.expired && !finished.current) {
          finished.current = true;
          onFinished(attemptId, 'time_up');
        }
      } catch {
        // Offline: the local countdown keeps running; the server will charge at most a short grace.
      }
    };
    void beat();
    const id = window.setInterval(() => void beat(), 15000);
    return () => window.clearInterval(id);
  }, [splitSessions, courseId, examId, attemptId, onFinished]);

  const pause = async () => {
    setPausing(true);
    try {
      await flush();
      await assessmentApi.heartbeat(courseId, examId, attemptId);
    } catch {
      // Answers still queued stay in the offline queue; leaving is allowed regardless.
    }
    finished.current = true; // stop timers/finish retries from this mounted session
    onPause?.();
  };

  // ---- Integrity ---------------------------------------------------------------------------
  const [violations, setViolations] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const maxViolations = initial.max_violations;

  const report = useCallback(
    async (type: IntegrityEventType, counted: boolean) => {
      try {
        const res = await assessmentApi.recordIntegrityEvent(courseId, examId, attemptId, type);
        if (counted) {
          setViolations(res.violation_count);
          setWarning(`مخالفة ${formatNumber(res.violation_count)} من ${formatNumber(res.max_violations)}. عند بلوغ الحد يُسلَّم الاختبار تلقائيًا.`);
          if (res.auto_submitted && !finished.current) {
            finished.current = true;
            onFinished(attemptId, 'violations');
          }
        }
      } catch {
        // The event could not be sent (offline); the server timer and limits still apply.
      }
    },
    [attemptId, courseId, examId, onFinished],
  );

  const { supportsFullscreen, isFullscreen, enterFullscreen } = useExamLockdown({
    active: !submitting,
    onViolation: (t) => void report(t, true),
    onBlocked: (t) => void report(t, false),
  });
  // Entering fullscreen is required, but a browser that refuses it must not lock the student out:
  // after a failed attempt they may continue and the refusal is recorded as a counted violation.
  const [wasFullscreen, setWasFullscreen] = useState(false);
  const [fsRefused, setFsRefused] = useState(false);
  const [fsWaived, setFsWaived] = useState(false);
  useEffect(() => {
    if (isFullscreen) setWasFullscreen(true);
  }, [isFullscreen]);
  const needsFullscreen = supportsFullscreen && !isFullscreen && !submitting && !fsWaived;

  const retryFullscreen = async () => {
    await enterFullscreen();
    window.setTimeout(() => {
      if (!document.fullscreenElement) setFsRefused(true);
    }, 800);
  };
  const continueWithoutFullscreen = () => {
    setFsWaived(true);
    void report('fullscreen_exit', true);
  };

  // ---- Derived -----------------------------------------------------------------------------
  const q = questions[index];
  const answeredCount = useMemo(() => questions.filter((x) => isAnswered(answers[x.id])).length, [questions, answers]);
  const unanswered = questions.length - answeredCount;
  const low = remaining < 300;

  if (!q) return null;

  return (
    <div className="exam-lockdown relative min-h-screen bg-surface-sunken text-fg" onCopy={(e) => e.preventDefault()}>
      <style>{`.exam-lockdown{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}.exam-lockdown input,.exam-lockdown textarea{-webkit-user-select:text;user-select:text}@media print{body *{display:none!important}}`}</style>
      <Watermark text={`${user?.name ?? ''} · ${user?.email ?? ''}`} />

      <header className="chrome-surface sticky top-0 z-30 border-b border-border shadow-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-fg-muted">الاختبار قيد التنفيذ</p>
            <p className="font-bold">
              السؤال {formatNumber(index + 1)} من {formatNumber(questions.length)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', violations > 0 ? 'bg-danger-subtle text-danger-subtle-fg' : 'bg-surface-muted text-fg-muted')}
              title="المخالفات المسجّلة"
            >
              <ShieldAlert size={14} aria-hidden /> {formatNumber(violations)}/{formatNumber(maxViolations)}
            </span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', online && unsaved === 0 ? 'bg-success-subtle text-success-subtle-fg' : 'bg-warning-subtle text-warning-subtle-fg')}>
              {online ? <Wifi size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
              {online ? (unsaved > 0 ? 'جارٍ الحفظ…' : savedAt ? 'تم الحفظ' : 'متصل') : `غير متصل — ${formatNumber(unsaved)} بانتظار الإرسال`}
            </span>
            <span
              role="timer"
              aria-label="الوقت المتبقي"
              className={cn('ltr-isolate inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-base font-bold tabular', low ? 'bg-danger text-danger-fg' : 'bg-primary-subtle text-primary-subtle-fg')}
            >
              <Clock size={16} aria-hidden /> {clock(remaining)}
            </span>
            {splitSessions && onPause && (
              <button type="button" onClick={() => void pause()} disabled={pausing || submitting} className={buttonClasses('secondary', 'md')} title="يتوقف العدّاد وتُحفظ إجاباتك، وتكمل لاحقًا خلال فترة الاختبار">
                {pausing ? 'جارٍ الحفظ…' : 'احفظ وأكمل لاحقًا'}
              </button>
            )}
            <button type="button" onClick={() => setConfirmOpen(true)} className={buttonClasses('primary', 'md')}>
              تسليم
            </button>
          </div>
        </div>
        {warning && (
          <p role="alert" className="border-t border-danger/30 bg-danger-subtle px-4 py-2 text-center text-sm font-medium text-danger-subtle-fg">
            {warning}
          </p>
        )}
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
        <main className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-xs sm:p-7" aria-live="polite">
            <QuestionView
              key={q.id}
              question={q}
              answer={answers[q.id]}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
              onCommit={(v) => commit(q.id, v)}
              media={{ courseId, kind: 'exams', itemId: examId }}
              onPasteBlocked={() => void report('paste_attempt', false)}
            />
          </section>
          <nav className="flex items-center justify-between gap-3" aria-label="التنقل بين الأسئلة">
            <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className={buttonClasses('secondary', 'md')}>
              <ChevronRight size={16} aria-hidden /> السابق
            </button>
            <button
              type="button"
              onClick={() => setFlagged((prev) => new Set(prev.has(q.id) ? [...prev].filter((x) => x !== q.id) : [...prev, q.id]))}
              aria-pressed={flagged.has(q.id)}
              className={cn(buttonClasses('ghost', 'md'), flagged.has(q.id) && 'text-warning')}
            >
              <Flag size={16} aria-hidden /> {flagged.has(q.id) ? 'إلغاء التعليم' : 'علِّم للمراجعة'}
            </button>
            {index < questions.length - 1 ? (
              <button type="button" onClick={() => setIndex((i) => i + 1)} className={buttonClasses('primary', 'md')}>
                التالي <ChevronLeft size={16} aria-hidden />
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmOpen(true)} className={buttonClasses('primary', 'md')}>
                مراجعة وتسليم
              </button>
            )}
          </nav>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-bold">خريطة الأسئلة</h2>
            <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
              {questions.map((x, i) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`السؤال ${i + 1}${isAnswered(answers[x.id]) ? ' — تمت الإجابة' : ''}${flagged.has(x.id) ? ' — معلَّم' : ''}`}
                  aria-current={i === index ? 'step' : undefined}
                  className={cn(
                    'relative h-9 rounded-md border text-sm font-bold transition-colors',
                    i === index ? 'border-primary bg-primary-subtle text-primary-subtle-fg' : isAnswered(answers[x.id]) ? 'border-success bg-success text-success-fg' : 'border-border bg-surface text-fg-muted hover:bg-surface-muted',
                  )}
                >
                  {formatNumber(i + 1)}
                  {flagged.has(x.id) && <span className="absolute -end-1 -top-1 h-2.5 w-2.5 rounded-full bg-warning" aria-hidden />}
                </button>
              ))}
            </div>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-fg-muted">تمت الإجابة</dt><dd className="font-bold text-success">{formatNumber(answeredCount)}</dd></div>
              <div className="flex justify-between"><dt className="text-fg-muted">بلا إجابة</dt><dd className="font-bold text-warning">{formatNumber(unanswered)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      {needsFullscreen && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="fs-title" className="fixed inset-0 z-[90] grid place-items-center bg-surface-sunken p-6">
          <div className="max-w-md space-y-4 text-center">
            <ShieldAlert className="mx-auto text-danger" size={40} aria-hidden />
            <h2 id="fs-title" className="font-display text-2xl">{wasFullscreen ? 'عُد إلى وضع ملء الشاشة' : 'فعّل وضع ملء الشاشة للمتابعة'}</h2>
            <p className="text-fg-muted">
              {wasFullscreen
                ? 'خرجتَ من ملء الشاشة وسُجّلت مخالفة. الوقت ما زال يُحتسب، والأسئلة مخفية حتى تعود.'
                : 'يتطلب هذا الاختبار ملء الشاشة. الوقت يُحتسب، والأسئلة تظهر بعد التفعيل.'}
            </p>
            <button type="button" onClick={() => void retryFullscreen()} className={buttonClasses('primary', 'lg')}>
              {wasFullscreen ? 'العودة إلى الاختبار' : 'تفعيل ملء الشاشة'}
            </button>
            {fsRefused && (
              <div className="space-y-2 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-subtle-fg">
                <p>تعذّر تفعيل ملء الشاشة على هذا المتصفح. يمكنك المتابعة بدونه، لكن ذلك يُسجَّل كمخالفة.</p>
                <button type="button" onClick={continueWithoutFullscreen} className="font-semibold underline">
                  المتابعة بدون ملء الشاشة
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-[80] grid place-items-center bg-surface-overlay p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-raised p-6 text-center shadow-xl">
            <h2 id="confirm-title" className="text-xl font-bold">تأكيد تسليم الاختبار</h2>
            <p className="text-sm text-fg-muted">
              أجبتَ عن {formatNumber(answeredCount)} من {formatNumber(questions.length)} سؤالًا.
              {unanswered > 0 && <span className="mt-1 block font-semibold text-danger">يتبقى {formatNumber(unanswered)} سؤال بلا إجابة.</span>}
              {flagged.size > 0 && <span className="mt-1 block text-warning">لديك {formatNumber(flagged.size)} سؤال معلَّم للمراجعة.</span>}
            </p>
            <p className="text-xs text-fg-subtle">لا يمكن التراجع بعد التسليم.</p>
            {submitError && <p role="alert" className="text-sm font-medium text-danger">{submitError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={submitting} className={cn(buttonClasses('secondary', 'md'), 'flex-1')}>
                العودة للأسئلة
              </button>
              <button type="button" onClick={() => void finish('submitted')} disabled={submitting} className={cn(buttonClasses('primary', 'md'), 'flex-1')}>
                {submitting ? 'جارٍ التسليم…' : 'تسليم نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

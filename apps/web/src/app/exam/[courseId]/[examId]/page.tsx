'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { assessmentApi, type ActiveExamAttempt } from '../../../../lib/assessment-api';
import { ApiError } from '../../../../lib/api-client';
import type { Exam } from '../../../../types';
import { ExamBriefing } from '../../../../features/secure-exam/exam-briefing';
import { ExamSession, type FinishReason } from '../../../../features/secure-exam/exam-session';
import { useExamLockdown } from '../../../../features/secure-exam/use-exam-lockdown';
import { ErrorState } from '../../../../components/ui/error-state';
import { buttonClasses } from '../../../../components/ui/button-styles';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'briefing'; exam: Exam; canAttempt: boolean; resume?: ActiveExamAttempt }
  | { kind: 'running'; exam: Exam; data: ActiveExamAttempt }
  | { kind: 'paused' }
  | { kind: 'finished'; reason: FinishReason; resultsHref: string };

const FINISH_COPY: Record<FinishReason, { title: string; body: string }> = {
  submitted: { title: 'تم تسليم الاختبار', body: 'استُلمت إجاباتك بنجاح.' },
  time_up: { title: 'انتهى الوقت', body: 'سُلِّم الاختبار تلقائيًا بالإجابات المحفوظة.' },
  violations: { title: 'سُلِّم الاختبار تلقائيًا', body: 'بلغتَ الحد الأقصى من المخالفات، فسُلِّم الاختبار بما أجبتَ عنه، وسيراجع المدرّس السجل.' },
};

export default function SecureExamPage({ params }: { params: Promise<{ courseId: string; examId: string }> }) {
  const { courseId, examId } = use(params);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Only used here to open/close fullscreen from the user's click on the briefing.
  const { supportsFullscreen, enterFullscreen, exitFullscreen } = useExamLockdown({ active: false, onViolation: () => {}, onBlocked: () => {} });

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' });
    try {
      const [info, active] = await Promise.all([assessmentApi.getExam(courseId, examId), assessmentApi.getActiveAttempt(courseId, examId)]);
      setPhase({ kind: 'briefing', exam: info.exam, canAttempt: Boolean(info.can_attempt), resume: active ?? undefined });
    } catch {
      setPhase({ kind: 'error' });
    }
  }, [courseId, examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    if (phase.kind !== 'briefing') return;
    setStarting(true);
    setStartError(null);
    // Must run inside the click handler (user gesture), before any await.
    const fullscreen = enterFullscreen();
    try {
      const data = phase.resume ?? (await assessmentApi.startExam(courseId, examId));
      // Some browsers never settle the request; the session's fullscreen gate handles a refusal.
      await Promise.race([fullscreen, new Promise((resolve) => window.setTimeout(resolve, 1200))]);
      setPhase({ kind: 'running', exam: phase.exam, data });
    } catch (err) {
      await exitFullscreen();
      setStartError(err instanceof ApiError ? err.message : 'تعذّر بدء الاختبار. حاول مرة أخرى.');
    } finally {
      setStarting(false);
    }
  };

  const onFinished = useCallback(
    (attemptId: string, reason: FinishReason) => {
      void exitFullscreen();
      setPhase({ kind: 'finished', reason, resultsHref: `/student/courses/${courseId}/exams/${examId}/results?attemptId=${attemptId}` });
    },
    [courseId, examId, exitFullscreen],
  );

  if (phase.kind === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-sunken" aria-busy="true">
        <p className="text-fg-muted">جارٍ تجهيز الاختبار…</p>
      </div>
    );
  }
  if (phase.kind === 'error') {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-sunken px-4">
        <ErrorState title="تعذّر تحميل الاختبار" description="تحقق من الاتصال، أو أن الاختبار متاح لك." onRetry={load} />
      </div>
    );
  }
  if (phase.kind === 'briefing') {
    return (
      <div className="bg-surface-sunken">
        <ExamBriefing
          exam={phase.exam}
          courseId={courseId}
          canAttempt={phase.canAttempt}
          resumeSeconds={phase.resume?.remaining_seconds}
          supportsFullscreen={supportsFullscreen}
          starting={starting}
          error={startError}
          onStart={start}
        />
      </div>
    );
  }
  if (phase.kind === 'running') {
    return (
      <ExamSession
        courseId={courseId}
        examId={examId}
        initial={phase.data}
        onFinished={onFinished}
        onPause={() => {
          void exitFullscreen();
          setPhase({ kind: 'paused' });
        }}
      />
    );
  }
  if (phase.kind === 'paused') {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-sunken px-4">
        <div className="max-w-md space-y-4 rounded-2xl border border-border bg-surface p-8 text-center shadow-md">
          <h1 className="font-display text-2xl text-fg">حُفظ تقدّمك</h1>
          <p className="text-fg-muted">توقّف العدّاد وحُفظت إجاباتك. ارجع إلى هذه الصفحة وأكمل الاختبار في أي وقت خلال فترة الاختبار؛ يُحتسب فقط الوقت الذي تقضيه داخل الاختبار.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => void load()} className={buttonClasses('primary', 'md')}>
              متابعة الآن
            </button>
            <Link href={`/student/courses/${courseId}`} className={buttonClasses('secondary', 'md')}>
              العودة للمقرر
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const copy = FINISH_COPY[phase.reason];
  return (
    <div className="grid min-h-screen place-items-center bg-surface-sunken px-4">
      <div className="max-w-md space-y-4 rounded-2xl border border-border bg-surface p-8 text-center shadow-md">
        <h1 className="font-display text-2xl text-fg">{copy.title}</h1>
        <p className="text-fg-muted">{copy.body}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => router.replace(phase.resultsHref)} className={buttonClasses('primary', 'md')}>
            عرض حالة الاختبار
          </button>
          <Link href={`/student/courses/${courseId}`} className={buttonClasses('secondary', 'md')}>
            العودة للمقرر
          </Link>
        </div>
      </div>
    </div>
  );
}

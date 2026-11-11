'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { assessmentApi } from '../../lib/assessment-api';
import { ApiError } from '../../lib/api-client';
import type { Assignment, AssignmentQuestion } from '../../types';
import { QuestionView, isAnswered, type AnswerValue } from '../secure-exam/question-view';
import { buttonClasses } from '../../components/ui/button-styles';
import { formatNumber } from '../../lib/format';

/**
 * Answer the questions of an assignment inside the platform (same question types and optional images as
 * exams; typed answers cannot be pasted). Submitting sends all answers; multiple-choice and short-answer
 * questions are graded immediately, essays wait for the teacher.
 */
export function AssignmentSolver({
  courseId,
  assignment,
  questions,
  onSubmitted,
  onCancel,
}: {
  courseId: string;
  assignment: Assignment;
  questions: AssignmentQuestion[];
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const answered = useMemo(() => questions.filter((q) => isAnswered(answers[q.id])).length, [questions, answers]);
  const unanswered = questions.length - answered;

  // Drafts survive an accidental refresh (kept only on this device, cleared on submit).
  const draftKey = `assignment-draft:${assignment.id}`;
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) setAnswers(JSON.parse(saved));
    } catch {
      // ignore a corrupted or unavailable draft
    }
  }, [draftKey]);
  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(answers));
    } catch {
      // storage unavailable: drafts are a convenience only
    }
  }, [answers, draftKey]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await assessmentApi.submitAssignment(courseId, assignment.id, {
        answers: questions
          .filter((q) => isAnswered(answers[q.id]))
          .map((q) => ({ question_id: q.id, answer_text: answers[q.id]?.answer_text, selected_options: answers[q.id]?.selected_options })),
      });
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال الإجابات. تحقق من الاتصال وحاول مرة أخرى.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {questions.map((q, i) => (
        <section key={q.id} className="space-y-3 rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold text-fg-muted">
            السؤال {formatNumber(i + 1)} من {formatNumber(questions.length)}
          </p>
          <QuestionView
            question={{ ...q, exam_id: q.assignment_id }}
            answer={answers[q.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            onCommit={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            media={{ courseId, kind: 'assignments', itemId: assignment.id }}
          />
        </section>
      ))}

      {error && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm font-medium text-danger-subtle-fg">
          {error}
        </p>
      )}

      {confirming ? (
        <div role="alertdialog" className="space-y-3 rounded-xl border border-warning/30 bg-warning-subtle p-4 text-sm text-warning-subtle-fg">
          <p>
            أجبتَ عن {formatNumber(answered)} من {formatNumber(questions.length)} سؤالًا.
            {unanswered > 0 && <strong className="ms-1">يتبقى {formatNumber(unanswered)} بلا إجابة.</strong>} بعد الإرسال لا يمكن التعديل
            {assignment.allow_resubmission ? ' إلا بإعادة التسليم.' : '.'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className={buttonClasses('secondary', 'md')}>
              مراجعة
            </button>
            <button type="button" onClick={() => void submit()} disabled={submitting} className={buttonClasses('primary', 'md')}>
              {submitting ? 'جارٍ الإرسال…' : 'إرسال نهائي'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={buttonClasses('secondary', 'md')}>
            إلغاء
          </button>
          <button type="button" onClick={() => setConfirming(true)} disabled={answered === 0} className={buttonClasses('primary', 'md')}>
            مراجعة وإرسال
          </button>
        </div>
      )}
    </div>
  );
}

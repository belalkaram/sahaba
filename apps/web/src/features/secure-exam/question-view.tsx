'use client';

import React from 'react';
import type { ExamQuestion } from '../../types';
import type { AssessmentKind } from '../../lib/assessment-api';
import { cn } from '../../lib/cn';
import { QuestionImage } from '../../components/assessment/question-image';
import { useNoPaste } from './no-paste';

export interface AnswerValue {
  answer_text?: string;
  selected_options?: string[];
}

const TYPE_LABELS: Record<ExamQuestion['question_type'], string> = {
  multiple_choice: 'اختيار من متعدد',
  multiple_select: 'اختيار إجابات متعددة',
  true_false: 'صح / خطأ',
  short_answer: 'إجابة قصيرة',
  essay: 'سؤال مقالي',
};

export function isAnswered(a?: AnswerValue): boolean {
  return Boolean((a?.answer_text && a.answer_text.trim() !== '' && a.answer_text !== '[]') || (a?.selected_options && a.selected_options.length > 0));
}

function Choice({ selected, onSelect, kind, children }: { selected: boolean; onSelect: () => void; kind: 'radio' | 'checkbox'; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role={kind}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-4 text-start transition-colors',
        selected ? 'border-primary bg-primary-subtle text-primary-subtle-fg' : 'border-border bg-surface hover:bg-surface-muted',
      )}
    >
      <span
        aria-hidden
        className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center border-2', kind === 'radio' ? 'rounded-full' : 'rounded-sm', selected ? 'border-primary bg-primary' : 'border-border-strong')}
      >
        {selected && <span className={cn('bg-primary-fg', kind === 'radio' ? 'h-2 w-2 rounded-full' : 'h-2.5 w-2.5 rounded-[2px]')} />}
      </span>
      <span className="min-w-0 break-words text-base">{children}</span>
    </button>
  );
}

export function QuestionView({
  question,
  answer,
  onChange,
  onCommit,
  media,
  onPasteBlocked,
}: {
  question: ExamQuestion;
  answer?: AnswerValue;
  /** Local change (typing). */
  onChange: (value: AnswerValue) => void;
  /** Persist now (choice made, or text field left). */
  onCommit: (value: AnswerValue) => void;
  /** Where the question's image is served from (exam or assignment); omit to never show one. */
  media?: { courseId: string; kind: AssessmentKind; itemId: string };
  /** Called when a paste / drop / cut / copy on the answer field was blocked (exam runner logs it). */
  onPasteBlocked?: () => void;
}) {
  const q = question;
  const noPaste = useNoPaste(onPasteBlocked);
  const choose = (value: AnswerValue) => {
    onChange(value);
    onCommit(value);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-fg-muted">{TYPE_LABELS[q.question_type]}</span>
        <span className="text-sm font-semibold text-fg-muted">{q.points} درجة</span>
      </div>

      <p className="whitespace-pre-line break-words text-lg font-bold leading-relaxed text-fg">{q.question_text}</p>

      {q.has_image && media && <QuestionImage courseId={media.courseId} kind={media.kind} itemId={media.itemId} questionId={q.id} />}

      {q.question_type === 'multiple_choice' && (
        <div className="space-y-2.5" role="radiogroup" aria-label="الخيارات">
          {q.options?.map((opt) => (
            <Choice key={opt} kind="radio" selected={answer?.answer_text === opt} onSelect={() => choose({ answer_text: opt })}>
              {opt}
            </Choice>
          ))}
        </div>
      )}

      {q.question_type === 'multiple_select' && (
        <div className="space-y-2.5" role="group" aria-label="الخيارات">
          <p className="text-sm text-fg-muted">يمكنك تحديد أكثر من إجابة.</p>
          {q.options?.map((opt) => {
            const current = answer?.selected_options ?? [];
            const selected = current.includes(opt);
            return (
              <Choice
                key={opt}
                kind="checkbox"
                selected={selected}
                onSelect={() => {
                  const next = selected ? current.filter((o) => o !== opt) : [...current, opt];
                  choose({ selected_options: next, answer_text: JSON.stringify(next) });
                }}
              >
                {opt}
              </Choice>
            );
          })}
        </div>
      )}

      {q.question_type === 'true_false' && (
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="صح أو خطأ">
          {[
            { value: 'true', label: 'صح' },
            { value: 'false', label: 'خطأ' },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={answer?.answer_text === o.value}
              onClick={() => choose({ answer_text: o.value })}
              className={cn(
                'rounded-lg border p-5 text-lg font-bold transition-colors',
                answer?.answer_text === o.value ? 'border-primary bg-primary-subtle text-primary-subtle-fg' : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {q.question_type === 'short_answer' && (
        <input
          type="text"
          value={answer?.answer_text ?? ''}
          onChange={(e) => onChange({ answer_text: e.target.value })}
          onBlur={() => answer && onCommit(answer)}
          placeholder="اكتب إجابتك هنا…"
          {...noPaste.props}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base text-fg outline-none focus:border-primary focus:shadow-[var(--focus-ring)]"
        />
      )}

      {q.question_type === 'essay' && (
        <textarea
          rows={8}
          value={answer?.answer_text ?? ''}
          onChange={(e) => onChange({ answer_text: e.target.value })}
          onBlur={() => answer && onCommit(answer)}
          placeholder="اكتب إجابتك بالتفصيل…"
          {...noPaste.props}
          className="w-full resize-y rounded-lg border border-border bg-surface p-4 text-base leading-relaxed text-fg outline-none focus:border-primary focus:shadow-[var(--focus-ring)]"
        />
      )}

      {(q.question_type === 'short_answer' || q.question_type === 'essay') && (
        <p role="status" className={cn('text-sm', noPaste.hint ? 'font-semibold text-danger' : 'text-fg-subtle')}>
          {noPaste.hint ? 'اللصق والنسخ غير مسموحين هنا — اكتب إجابتك بنفسك داخل الصفحة.' : 'اكتب إجابتك بنفسك؛ اللصق من خارج الصفحة غير متاح.'}
        </p>
      )}
    </div>
  );
}

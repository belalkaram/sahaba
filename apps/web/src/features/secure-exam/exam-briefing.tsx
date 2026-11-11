'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Clock, Expand, ListOrdered, ShieldAlert, WifiOff } from 'lucide-react';
import type { Exam } from '../../types';
import { buttonClasses } from '../../components/ui/button-styles';
import { formatDateTime, formatNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

const RULES = [
  'يبدأ العدّ التنازلي فور الضغط على «ابدأ الاختبار» ولا يتوقف، حتى لو أغلقت الصفحة أو انقطع الاتصال.',
  'يعمل الاختبار في وضع ملء الشاشة. الخروج منه أو مغادرة الصفحة أو تبديل النافذة يُسجَّل كمخالفة ويراها المدرّس.',
  'عند بلوغ الحد الأقصى من المخالفات يُسلَّم الاختبار تلقائيًا بما أجبت عنه.',
  'النسخ واللصق والقائمة اليمنى واختصارات الطباعة والحفظ وأدوات المطوّر معطّلة، ومحاولاتها تُسجَّل.',
  'تُحفظ إجاباتك تلقائيًا. لو انقطع الاتصال تبقى محفوظة على جهازك وتُرسل فور عودته.',
  'عند انتهاء الوقت يُسلَّم الاختبار تلقائيًا من الخادم.',
];

/** Rule 1 changes for split-session exams: the clock only runs while the exam page is open. */
const SPLIT_FIRST_RULE =
  'مدة الاختبار الكلية موزّعة على جلسات: تدخل وتخرج كما تشاء خلال فترة الاختبار، ولا يُحتسب إلا الوقت الذي تكون فيه صفحة الاختبار مفتوحة. زر «احفظ وأكمل لاحقًا» يوقف العدّاد ويحفظ إجاباتك. لو أُغلقت الصفحة فجأة أو انقطع الاتصال يُخصم بضع ثوانٍ فقط.';

export interface BriefingProps {
  exam: Exam;
  courseId: string;
  canAttempt: boolean;
  /** Seconds left of an attempt already in progress (resume mode). */
  resumeSeconds?: number;
  supportsFullscreen: boolean;
  starting: boolean;
  error?: string | null;
  onStart: () => void;
}

export function ExamBriefing({ exam, courseId, canAttempt, resumeSeconds, supportsFullscreen, starting, error, onStart }: BriefingProps) {
  const resuming = resumeSeconds !== undefined;
  const [agreed, setAgreed] = useState(resuming);
  const ready = (canAttempt || resuming) && agreed && !starting;
  const rules = exam.allow_split_sessions ? [SPLIT_FIRST_RULE, ...RULES.slice(1)] : RULES;

  const stats = [
    { icon: Clock, label: 'المدة', value: resuming ? `متبقٍّ ${Math.max(1, Math.ceil(resumeSeconds / 60))} دقيقة` : `${formatNumber(exam.duration_minutes)} دقيقة` },
    { icon: ListOrdered, label: 'الأسئلة', value: formatNumber(exam.questions_count ?? 0) },
    { icon: ShieldAlert, label: 'الدرجة الكلية', value: formatNumber(exam.total_points) },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-10">
      <div className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
        <header className="space-y-2 text-center">
          <p className="text-sm font-semibold text-primary">{resuming ? 'استئناف اختبار قيد التنفيذ' : 'تعليمات الاختبار'}</p>
          <h1 className="break-words font-display text-3xl text-fg">{exam.title}</h1>
          {exam.description && <p className="break-words text-fg-muted">{exam.description}</p>}
        </header>

        <dl className="grid grid-cols-3 gap-3">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-surface-sunken p-3 text-center">
              <Icon size={18} className="mx-auto mb-1 text-primary" aria-hidden />
              <dt className="text-xs text-fg-muted">{label}</dt>
              <dd className="break-words text-sm font-bold text-fg">{value}</dd>
            </div>
          ))}
        </dl>

        {exam.allow_split_sessions && (exam.opens_at || exam.closes_at) && (
          <p className="rounded-lg border border-primary/25 bg-primary-subtle p-3 text-center text-sm text-primary-subtle-fg">
            فترة الاختبار{exam.opens_at ? ` من ${formatDateTime(exam.opens_at)}` : ''}{exam.closes_at ? ` إلى ${formatDateTime(exam.closes_at)}` : ''} — ويمكنك توزيع {formatNumber(exam.duration_minutes)} دقيقة على أكثر من جلسة.
          </p>
        )}
        {exam.closes_at && !exam.allow_split_sessions && <p className="text-center text-sm text-fg-muted">آخر موعد لإنهاء الاختبار: {formatDateTime(exam.closes_at)}</p>}

        <section aria-labelledby="rules-title" className="space-y-3 rounded-lg border border-warning/30 bg-warning-subtle p-4">
          <h2 id="rules-title" className="flex items-center gap-2 font-bold text-warning-subtle-fg">
            <ShieldAlert size={18} aria-hidden /> قواعد صارمة — اقرأها قبل البدء
          </h2>
          <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed text-fg">
            {rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          {!supportsFullscreen && (
            <p className="flex items-start gap-2 text-sm font-medium text-warning-subtle-fg">
              <Expand size={16} className="mt-0.5 shrink-0" aria-hidden /> متصفح جهازك لا يدعم ملء الشاشة؛ ستُسجَّل مغادرة الصفحة والنافذة فقط. يُفضَّل استخدام حاسوب.
            </p>
          )}
          <p className="flex items-start gap-2 text-xs text-fg-muted">
            <WifiOff size={14} className="mt-0.5 shrink-0" aria-hidden /> الحماية داخل المتصفح تردع وتسجّل ولا تمنع كل أشكال الغش؛ الحَكَم النهائي هو مراجعة المدرّس.
          </p>
        </section>

        {!canAttempt && !resuming ? (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger-subtle p-4 text-center text-sm font-medium text-danger-subtle-fg">
            هذا الاختبار غير متاح لك الآن (غير مفتوح، أو استنفدت المحاولات المسموحة).
          </div>
        ) : (
          !resuming && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
              <span className="text-sm text-fg">قرأتُ القواعد وأوافق عليها، وأفهم أن المخالفات تُسجَّل وقد تؤدي إلى تسليم الاختبار تلقائيًا.</span>
            </label>
          )
        )}

        {error && (
          <p role="alert" className="text-center text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button type="button" onClick={onStart} disabled={!ready} className={cn(buttonClasses('primary', 'lg'), 'flex-1')}>
            {starting ? 'جارٍ التجهيز…' : resuming ? 'استئناف الاختبار' : 'ابدأ الاختبار'}
          </button>
          <Link href={`/student/courses/${courseId}`} className={cn(buttonClasses('secondary', 'lg'), 'sm:w-40')}>
            العودة
          </Link>
        </div>
      </div>
    </div>
  );
}

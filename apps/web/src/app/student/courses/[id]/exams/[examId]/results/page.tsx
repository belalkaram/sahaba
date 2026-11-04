'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { assessmentApi } from '@/lib/assessment-api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircleIcon, ClockIcon, AlertCircleIcon } from '@/components/icons';

import { formatPercent } from '../../../../../../../lib/format';
interface PageProps {
  params: Promise<{
    id: string;
    examId: string;
  }>;
}

export default function StudentExamResultsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;
  const examId = resolvedParams.examId;
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');

  const [loading, setLoading] = useState(true);
  const [resultData, setResultData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        if (!attemptId) {
          // If attemptId is not in URL, get exam attempts for student
          const exData = await assessmentApi.getExam(courseId, examId);
          const lastAttempt = exData.student_attempts?.[0];
          if (!lastAttempt) {
            setError('لم يتم العثور على محاولات سابقة لهذا الامتحان.');
            return;
          }
          const res = await assessmentApi.getExamResults(courseId, examId, lastAttempt.id);
          setResultData(res);
        } else {
          const res = await assessmentApi.getExamResults(courseId, examId, attemptId);
          setResultData(res);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'تعذر تحميل نتيجة الامتحان.');
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [courseId, examId, attemptId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-xs text-secondary font-bold">جارٍ استخراج وتجميع نتيجة الامتحان...</p>
      </div>
    );
  }

  if (error || !resultData) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-xl bg-surface border border-border text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
          <AlertCircleIcon className="w-6 h-6" />
        </div>
        <h2 className="font-bold text-foreground text-base">مراجعة النتيجة</h2>
        <p className="text-xs text-secondary leading-relaxed">{error || 'لا يمكن عرض النتيجة حالياً.'}</p>
        <Link
          href={`/student/courses/${courseId}`}
          className="inline-block px-5 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover transition-colors"
        >
          العودة للمقرر
        </Link>
      </div>
    );
  }

  const { attempt, answers, details_hidden, message } = resultData;
  const score = attempt?.score ?? 0;
  const total = attempt?.total_points ?? 100;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const isPassed = percentage >= 50;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-secondary mb-1">
            <Link href={`/student/courses/${courseId}`} className="hover:text-primary">
              المقرر
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">نتيجة الامتحان</span>
          </div>
          <h1 className="text-2xl font-black text-foreground">ملخص نتيجة الامتحان</h1>
        </div>

        <Link
          href={`/student/courses/${courseId}`}
          className="px-4 py-2 rounded-md border border-border text-xs font-bold hover:bg-background transition-colors"
        >
          العودة للمقرر
        </Link>
      </div>

      {/* Summary Score Card */}
      <Card className="p-8 text-center space-y-4 bg-gradient-to-b from-surface to-background border-border">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
            isPassed ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'
          }`}
        >
          {isPassed ? <CheckCircleIcon className="w-8 h-8" /> : <AlertCircleIcon className="w-8 h-8" />}
        </div>

        <div>
          <Badge variant={isPassed ? 'success' : 'danger'}>
            {isPassed ? 'ناجح (Passed)' : 'دون درجة النجاح'}
          </Badge>
          <div className="text-4xl font-black text-foreground mt-2">
            {score} <span className="text-lg text-secondary font-normal">/ {total}</span>
          </div>
          <p className="text-xs text-secondary mt-1 font-bold">النسبة المئوية: {formatPercent(percentage)}</p>
        </div>

        {attempt?.feedback && (
          <div className="max-w-md mx-auto p-3.5 rounded-md bg-primary/5 border border-primary/20 text-xs text-primary leading-relaxed">
            <span className="font-bold">ملاحظات المعلم: </span>
            <span>{attempt.feedback}</span>
          </div>
        )}
      </Card>

      {/* Policy details hidden alert */}
      {details_hidden && (
        <Card className="p-6 text-center space-y-2 border-dashed">
          <ClockIcon className="w-6 h-6 text-secondary mx-auto" />
          <h3 className="font-bold text-foreground text-sm">تفاصيل الإجابات محجوبة مؤقتاً</h3>
          <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
            {message || 'سيتم إتاحة المراجعة التفصيلية لجميع الأسئلة والإجابات النموذجية فور اعتماد ونشر الدرجات من قبل معلم المادة.'}
          </p>
        </Card>
      )}

      {/* Detailed Answers Review (When permitted) */}
      {!details_hidden && answers && answers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-black text-foreground">المراجعة التفصيلية للأسئلة والإجابات</h2>

          <div className="space-y-4">
            {answers.map((ans: any, idx: number) => {
              const isCorrect = ans.is_correct === true;
              const isEssay = ans.question_type === 'essay';

              return (
                <Card
                  key={ans.question_id || idx}
                  className={`p-5 space-y-3 border-r-4 ${
                    isEssay
                      ? 'border-r-warning'
                      : isCorrect
                      ? 'border-r-primary'
                      : 'border-r-danger'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-secondary">السؤال {idx + 1}</span>
                    <Badge variant={isEssay ? 'warning' : isCorrect ? 'success' : 'danger'}>
                      {isEssay
                        ? `مقالي (${ans.awarded_points ?? 0} / ${ans.points} درجات)`
                        : isCorrect
                        ? `صحيح (+${ans.awarded_points} درجات)`
                        : `خطأ (0 / ${ans.points})`}
                    </Badge>
                  </div>

                  <p className="font-bold text-foreground text-sm leading-relaxed">{ans.question_text}</p>

                  <div className="space-y-2 text-xs pt-1">
                    <div className="p-3 rounded-md bg-background border border-border">
                      <span className="font-bold text-secondary">إجابتك: </span>
                      <span className={isCorrect ? 'text-primary font-semibold' : 'text-danger font-semibold'}>
                        {ans.student_answer || 'لم تقم بالإجابة'}
                      </span>
                    </div>

                    {!isCorrect && ans.correct_answer && (
                      <div className="p-3 rounded-md bg-primary-subtle dark:bg-primary/20 text-primary dark:text-primary border border-primary/30 dark:border-primary/40 font-medium">
                        <span className="font-bold">الإجابة النموذجية الصحيحة: </span>
                        <span>{ans.correct_answer}</span>
                      </div>
                    )}

                    {ans.explanation && (
                      <div className="p-3 rounded-md bg-surface text-secondary border border-border leading-relaxed">
                        <span className="font-bold text-foreground">التفسير الأكاديمي: </span>
                        <span>{ans.explanation}</span>
                      </div>
                    )}

                    {ans.feedback && (
                      <div className="p-3 rounded-md bg-primary/5 text-primary border border-primary/20">
                        <span className="font-bold">ملاحظة المصحح: </span>
                        <span>{ans.feedback}</span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

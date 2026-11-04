'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { assessmentApi } from '@/lib/assessment-api';
import type { Assignment, AssignmentSubmission } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  UploadIcon,
} from '@/components/icons'

import { formatDateTime, formatNumber, formatPercent } from '../../../../../../lib/format';
interface PageProps {
  params: Promise<{
    id: string;
    assignmentId: string;
  }>;
}

export default function StudentAssignmentDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;
  const assignmentId = resolvedParams.assignmentId;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await assessmentApi.getAssignment(courseId, assignmentId);
      setAssignment(res.assignment);
      if (res.student_submission) {
        setSubmission(res.student_submission);
        setContent(res.student_submission.content || '');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'تعذر تحميل بيانات الواجب.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId, assignmentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxMb = assignment?.max_file_size_mb || 20;
      if (file.size > maxMb * 1024 * 1024) {
        alert(`حجم الملف يتجاوز الحد الأقصى المسموح به (${maxMb} ميجابايت).`);
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !selectedFile) {
      alert('يرجى كتابة نص الإجابة أو إرفاق ملف للواجب.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await assessmentApi.submitAssignment(courseId, assignmentId, {
        content: content.trim() || undefined,
        file: selectedFile || undefined,
      });
      setSubmission(res);
      setSelectedFile(null);
      setFeedback({ type: 'success', text: 'تم تسليم الواجب بنجاح وإرساله للمعلم للتصحيح!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'فشل تسليم الواجب.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-xl bg-surface border border-border text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <AlertCircleIcon className="w-6 h-6" />
        </div>
        <h2 className="font-bold text-foreground text-base">الواجب غير متاح</h2>
        <p className="text-xs text-secondary leading-relaxed">{error || 'لم يتم العثور على الواجب المطلوب.'}</p>
        <Link
          href={`/student/courses/${courseId}`}
          className="inline-block px-5 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover transition-colors"
        >
          العودة للمقرر
        </Link>
      </div>
    );
  }

  const isPastDue = assignment.due_at ? new Date() > new Date(assignment.due_at) : false;
  const canSubmit = !submission || assignment.allow_resubmission;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Breadcrumbs */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-secondary mb-1">
            <Link href={`/student/courses/${courseId}`} className="hover:text-primary">
              المقرر
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">تفاصيل الواجب</span>
          </div>
          <h1 className="text-2xl font-black text-foreground">{assignment.title}</h1>
        </div>

        <Link
          href={`/student/courses/${courseId}`}
          className="px-4 py-2 rounded-md border border-border text-xs font-bold hover:bg-background"
        >
          العودة للمقرر
        </Link>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-[14px] text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-primary-subtle text-primary border border-primary/30' : 'bg-danger-subtle text-danger border border-danger/30'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircleIcon className="w-4 h-4 text-primary" /> : <AlertCircleIcon className="w-4 h-4 text-danger" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Assignment Overview Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <Badge variant="neutral">الدرجة المخصصة: {assignment.points_possible} درجة</Badge>
          {assignment.due_at && (
            <div className={`flex items-center gap-1.5 text-xs font-bold ${isPastDue ? 'text-danger' : 'text-warning'}`}>
              <ClockIcon className="w-4 h-4" />
              <span>الموعد النهائي: {formatDateTime(assignment.due_at)}</span>
            </div>
          )}
        </div>

        {assignment.description ? (
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {assignment.description}
          </div>
        ) : (
          <p className="text-xs text-secondary italic">لا توجد تعليمات إضافية لهذا الواجب.</p>
        )}

        {/* Policy Badges */}
        <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap text-xs text-secondary">
          <span>شروط التسليم:</span>
          {assignment.allow_late ? (
            <Badge variant="warning">مسموح بالتسليم المتأخر (مع خصم {formatPercent(assignment.late_penalty_percent)})</Badge>
          ) : (
            <Badge variant="danger">غير مسموح بالتسليم بعد الموعد</Badge>
          )}
          {assignment.allow_resubmission ? (
            <Badge variant="info">مسموح بإعادة التسليم</Badge>
          ) : (
            <Badge variant="neutral">تسليم لمرة واحدة فقط</Badge>
          )}
          <span className="text-xs font-medium">الحد الأقصى للملف: {assignment.max_file_size_mb || 20} MB ({assignment.allowed_file_types || 'pdf, docx, png'})</span>
        </div>
      </Card>

      {/* Submitted Status & Grade Card (If already submitted) */}
      {submission && (
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground text-sm">تم تسليم الواجب بنجاح</h3>
              <Badge variant={submission.status === 'graded' ? 'success' : 'warning'}>
                {submission.status === 'graded' ? 'تم التصحيح والاعتماد' : 'بانتظار تصحيح المعلم'}
              </Badge>
              {submission.is_late && <Badge variant="danger">تسليم متأخر</Badge>}
            </div>

            {submission.submitted_at && (
              <span className="text-xs text-secondary font-medium">
                تاريخ التسليم: {formatDateTime(submission.submitted_at)}
              </span>
            )}
          </div>

          {/* Graded Score Display */}
          {submission.status === 'graded' && submission.score !== undefined && (
            <div className="p-4 rounded-lg bg-background border border-border flex items-center justify-between">
              <div>
                <span className="text-xs text-secondary font-bold">الدرجة الممنوحة:</span>
                <div className="text-2xl font-black text-primary">
                  {submission.score} <span className="text-xs text-secondary font-normal">/ {assignment.points_possible}</span>
                </div>
              </div>
              {submission.feedback && (
                <div className="max-w-md text-xs text-secondary text-start">
                  <span className="font-bold text-foreground">ملاحظات المعلم: </span>
                  <span>{submission.feedback}</span>
                </div>
              )}
            </div>
          )}

          {/* Submitted File Info */}
          {submission.file_name && (
            <div className="p-3 rounded-md bg-background border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileTextIcon className="w-4 h-4 text-primary" />
                <span className="font-bold text-foreground">{submission.file_name}</span>
                {submission.file_size && (
                  <span className="text-secondary">({formatNumber(submission.file_size / 1024 / 1024, 2)} MB)</span>
                )}
              </div>
              <a
                href={assessmentApi.getSubmissionFileDownloadUrl(courseId, assignmentId, submission.id)}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-sm bg-primary text-primary-fg font-bold"
              >
                تحميل نسختي
              </a>
            </div>
          )}
        </Card>
      )}

      {/* Submission Form (When submission is allowed) */}
      {canSubmit && (
        <Card className="p-6 space-y-4">
          <h3 className="font-bold text-foreground text-base border-b border-border pb-3">
            {submission ? 'إعادة تسليم الواجب (تحديث الإجابة)' : 'تسليم الواجب'}
          </h3>

          {isPastDue && !assignment.allow_late ? (
            <div className="p-4 rounded-lg bg-danger-subtle text-danger border border-danger/30 text-xs font-bold">
              عفواً، لقد انتهى الموعد النهائي لتسليم هذا الواجب وغير مسموح بالتسليم المتأخر.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {isPastDue && assignment.allow_late && (
                <div className="p-3 rounded-md bg-warning-subtle text-warning border border-warning/30 font-medium">
                  تنبيه: أنت تقوم بالتسليم بعد الموعد النهائي. سيتم تطبيق نسبة خصم التأخير ({formatPercent(assignment.late_penalty_percent)}).
                </div>
              )}

              <div>
                <label className="block font-bold text-secondary mb-1">إجابتك النصية (اختياري إذا أرفقت ملفاً):</label>
                <textarea aria-label="إجابتك النصية (اختياري إذا أرفقت ملفاً):"
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="اكتب ردك أو تقريرك هنا..."
                  className="w-full p-3.5 rounded-lg border border-border bg-background text-sm leading-relaxed outline-none focus:border-primary"
                ></textarea>
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">إرفاق ملف الواجب:</label>
                <div className="p-6 rounded-lg border-2 border-dashed border-border bg-background hover:bg-surface/50 text-center space-y-2 cursor-pointer relative">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <UploadIcon className="w-8 h-8 text-primary mx-auto" />
                  <p className="font-bold text-foreground text-xs">
                    {selectedFile ? selectedFile.name : 'انقر أو اسحب الملف هنا للرفع'}
                  </p>
                  <p className="text-xs text-secondary">
                    الامتدادات المدعومة: {assignment.allowed_file_types || 'pdf, docx, png, zip'} (أقصى حجم: {assignment.max_file_size_mb || 20} MB)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-md bg-primary text-primary-fg font-bold text-xs hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? 'جارٍ رفع وتسليم الواجب...' : 'تأكيد تسليم الواجب'}
                </button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}

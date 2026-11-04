'use client';

import React, { useEffect, useState } from 'react';
import { educationApi } from '../../../lib/education-api';
import { assessmentApi } from '../../../lib/assessment-api';
import type { Course, Assignment } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import { ClockIcon, FileTextIcon } from '../../../components/icons';

import { NotebookPen } from 'lucide-react';
import { IconNext } from '../../../components/icons/directional';
import { formatDate, formatNumber } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function StudentAssignmentsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<{ course: Course; item: Assignment }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const cList = await educationApi.getCourses();
      setCourses(cList);

      const allAssignments: { course: Course; item: Assignment }[] = [];
      for (const course of cList) {
        const aList = await assessmentApi.getAssignments(course.id).catch(partial([]));
        for (const a of aList) {
          allAssignments.push({ course, item: a });
        }
      }
      setAssignments(allAssignments);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const handleSubmit = async (courseId: string, assignmentId: string) => {
    if (!submissionContent.trim()) return;
    try {
      await assessmentApi.submitAssignment(courseId, assignmentId, submissionContent);
      setSuccessMsg('تم تسليم الواجب بنجاح وإرساله للمعلم للتقييم!');
      setSubmittingId(null);
      setSubmissionContent('');
      loadAssignments();
    } catch {
      alert('حدث خطأ أثناء تسليم الواجب.');
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <PageHeader
        title="الواجبات والتكليفات المدرسية"
        subtitle="تابع الواجبات المستحقة، ارفع الإجابات والحلول، واطلع على ملاحظات المعلم."
        actions={
          <Badge variant="success">إجمالي الواجبات: {formatNumber(assignments.length)}</Badge>
        }
      />

      {successMsg && (
        <div className="rounded-md border border-success/30 bg-success-subtle p-4 text-success text-xs font-semibold flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="hover:underline">إغلاق</button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-fg-muted text-sm">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>جارٍ تحميل الواجبات...</p>
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={20} strokeWidth={1.75} aria-hidden />}
          title="لا توجد واجبات حالياً"
          description="لا توجد واجبات دراسية مطلوبة في مقرراتك في الوقت الحالي."
        />
      ) : (
        <div className="space-y-4">
          {assignments.map(({ course, item }) => (
            <Card key={item.id} className="p-6 bg-surface border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-subtle text-primary shrink-0">
                    <FileTextIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary font-bold px-2 py-0.5 rounded-xs bg-primary-subtle border border-primary/20">
                        {course.code}
                      </span>
                      <h3 className="text-base font-bold text-fg">{item.title}</h3>
                    </div>
                    <p className="text-xs text-fg-muted mt-1">المقرر: {course.title}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold text-fg-muted">
                    الدرجة: {item.points_possible} نقطة
                  </span>
                  {item.due_at && (
                    <span className="text-xs text-fg-muted flex items-center gap-1">
                      <ClockIcon size={12} /> تاريخ الاستحقاق: {formatDate(item.due_at)}
                    </span>
                  )}
                  <Badge variant="info">مستحق</Badge>
                </div>
              </div>

              {item.description && (
                <p className="mt-3 text-xs text-fg-muted bg-surface-raised p-3 rounded-md border border-border leading-relaxed">
                  {item.description}
                </p>
              )}

              {/* Submission Box */}
              <div className="mt-4 pt-4 border-t border-border">
                {submittingId === item.id ? (
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      value={submissionContent}
                      onChange={(e) => setSubmissionContent(e.target.value)}
                      placeholder="اكتب إجابتك أو ملخص الحل هنا..."
                      className="w-full bg-surface-sunken border border-border rounded-md p-3 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setSubmittingId(null)}
                        className="px-3 py-1.5 rounded-sm border border-border text-xs text-fg-muted hover:bg-surface-raised transition-colors"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={() => handleSubmit(course.id, item.id)}
                        className="px-4 py-1.5 rounded-sm bg-primary hover:bg-primary-hover text-primary-fg text-xs font-semibold transition-colors"
                      >
                        إرسال الإجابة
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSubmittingId(item.id);
                      setSubmissionContent('');
                    }}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                  >
                    
 تسليم الواجب الآن <IconNext size={16} />
 </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { assessmentApi } from '../../../lib/assessment-api';
import { educationApi } from '../../../lib/education-api';
import type { Assignment, Course, Exam, AssignmentSubmission } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import { FileTextIcon, GraduationCapIcon, PlusIcon } from '../../../components/icons';

import { CircleCheck, CircleX, GraduationCap, NotebookPen, X } from 'lucide-react';
import { formatDateTime, formatNumber } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function TeacherAssessmentsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [assignments, setAssignments] = useState<{ course: Course; item: Assignment }[]>([]);
  const [exams, setExams] = useState<{ course: Course; item: Exam }[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Assignment State
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignPoints, setAssignPoints] = useState(10);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Submissions Modal State
  const [selectedAssignment, setSelectedAssignment] = useState<{ course: Course; item: Assignment } | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Individual Grading Modal State
  const [activeSubmission, setActiveSubmission] = useState<AssignmentSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [isGrading, setIsGrading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const cList = await educationApi.getCourses();
      setCourses(cList);

      if (cList.length > 0) {
        setSelectedCourseId(cList[0].id);
      }

      const allAssignments: { course: Course; item: Assignment }[] = [];
      const allExams: { course: Course; item: Exam }[] = [];

      for (const course of cList) {
        const [aList, eList] = await Promise.all([
          assessmentApi.getAssignments(course.id).catch(partial([])),
          assessmentApi.getExams(course.id).catch(partial([])),
        ]);

        aList.forEach((a) => allAssignments.push({ course, item: a }));
        eList.forEach((e) => allExams.push({ course, item: e }));
      }

      setAssignments(allAssignments);
      setExams(allExams);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !assignTitle.trim()) return;

    try {
      await assessmentApi.createAssignment(selectedCourseId, {
        title: assignTitle.trim(),
        description: assignDesc.trim() || undefined,
        points_possible: assignPoints,
      });

      setFeedback({ type: 'success', text: 'تم إنشاء ونشر الواجب الدراسي بنجاح!' });
      setIsCreatingAssignment(false);
      setAssignTitle('');
      setAssignDesc('');
      setAssignPoints(10);
      loadData();
    } catch {
      setFeedback({ type: 'error', text: 'فشل إنشاء الواجب. يرجى مراجعة البيانات.' });
    }
  };

  const handleOpenAssignment = async (assignmentObj: { course: Course; item: Assignment }) => {
    setSelectedAssignment(assignmentObj);
    setLoadingSubmissions(true);
    try {
      const data = await assessmentApi.getAssignmentSubmissions(assignmentObj.course.id, assignmentObj.item.id);
      setSubmissions(data);
    } catch {
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleOpenGrading = (sub: AssignmentSubmission) => {
    setActiveSubmission(sub);
    setGradeScore(sub.score || 0);
    setGradeFeedback(sub.feedback || '');
  };

  const handleSubmitGrade = async () => {
    if (!activeSubmission || !selectedAssignment) return;
    try {
      setIsGrading(true);
      await assessmentApi.gradeSubmission(
        selectedAssignment.course.id,
        selectedAssignment.item.id,
        activeSubmission.id,
        gradeScore,
        gradeFeedback.trim() || undefined
      );

      setFeedback({ type: 'success', text: 'تم حفظ واعتماد الدرجة بنجاح!' });
      setActiveSubmission(null);
      handleOpenAssignment(selectedAssignment);
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء رصد الدرجة.' });
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="space-y-6 relative text-start">
      {/* Header */}
      <PageHeader
        title="إدارة الواجبات والتقييمات والاختبارات"
        subtitle="أنشئ التكليفات المدرسية والاختبارات الدورية، وراجع تسليمات الطلاب ورصد الدرجات المعتمدة."
        actions={
          <button
            onClick={() => setIsCreatingAssignment((v) => !v)}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg font-medium px-4 py-2 rounded-md text-xs transition-colors shadow-xs"
          >
            {isCreatingAssignment ? (
              <span>إلغاء</span>
            ) : (
              <>
                <PlusIcon size={14} />
                <span>إنشاء واجب دراسي جديد</span>
              </>
            )}
          </button>
        }
      />

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs font-semibold flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'border-success/30 bg-success-subtle text-success'
              : 'border-danger/30 bg-danger-subtle text-danger'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.type === 'success' ? <CircleCheck size={16} strokeWidth={1.75} aria-hidden /> : <CircleX size={16} strokeWidth={1.75} aria-hidden />}</span>
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-fg-muted hover:text-fg"
           aria-label="إغلاق">
            
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
        </div>
      )}

      {/* Create Assignment Form */}
      {isCreatingAssignment && (
        <Card className="p-6 border-primary/30 bg-surface shadow-xs">
          <h2 className="text-sm font-bold text-fg mb-4">إنشاء تكليف أو واجب جديد</h2>
          <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1">المقرر الدراسي</label>
                <select aria-label="المقرر الدراسي"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
                >
                  {courses.map((c) => (
                    <option className="bg-surface text-fg py-1.5" key={c.id} value={c.id}>
                      {c.title} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1">عنوان الواجب</label>
                <input aria-label="عنوان الواجب"
                  type="text"
                  required
                  placeholder="مثال: تمارين الباب الأول"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1">الدرجة العظمى</label>
                <input aria-label="الدرجة العظمى"
                  type="number"
                  min="1"
                  value={assignPoints}
                  onChange={(e) => setAssignPoints(Number(e.target.value))}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-fg-muted mb-1">تعليمات وتفاصيل الواجب</label>
              <textarea aria-label="تعليمات وتفاصيل الواجب"
                rows={2}
                placeholder="اكتب التوجيهات والمسائل المطلوبة من الطالب..."
                value={assignDesc}
                onChange={(e) => setAssignDesc(e.target.value)}
                className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingAssignment(false)}
                className="px-4 py-2 rounded-md border border-border text-xs text-fg-muted hover:bg-surface-raised"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-md bg-primary hover:bg-primary-hover text-primary-fg font-semibold text-xs transition-colors shadow-xs"
              >
                نشر الواجب للطلبة
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Grid of Assignments & Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignments Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-fg flex items-center gap-2">
              <FileTextIcon size={18} className="text-primary" />
              <span>الواجبات المنشورة ({formatNumber(assignments.length)})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-12 text-center text-fg-muted text-xs">جارٍ التحميل...</div>
          ) : assignments.length === 0 ? (
            <EmptyState
              icon={<NotebookPen size={20} strokeWidth={1.75} aria-hidden />}
              title="لا توجد واجبات منشورة"
              description="لم يتم إنشاء تكليفات أو واجبات في مقرراتك حتى الآن."
            />
          ) : (
            assignments.map((assignmentObj) => {
              const { course, item } = assignmentObj;
              return (
                <Card
                  key={item.id}
                  className="p-4 space-y-2 cursor-pointer hover:border-primary/50 transition-colors bg-surface border border-border shadow-xs"
                  onClick={() => handleOpenAssignment(assignmentObj)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-primary font-bold px-2 py-0.5 rounded-xs bg-primary-subtle border border-primary/20">
                      {course.code}
                    </span>
                    <Badge variant="success">{item.points_possible} نقطة</Badge>
                  </div>
                  <h3 className="text-sm font-bold text-fg">{item.title}</h3>
                  {item.description && (
                    <p className="text-xs text-fg-muted line-clamp-1">{item.description}</p>
                  )}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-fg-muted">
                    <span>انقر لعرض تسليمات الطلبة والتقييم</span>
                    <span className="text-primary font-medium">منشور للطلبة</span>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Exams Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-fg flex items-center gap-2">
              <GraduationCapIcon size={18} className="text-primary" />
              <span>الاختبارات الإلكترونية ({formatNumber(exams.length)})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-12 text-center text-fg-muted text-xs">جارٍ التحميل...</div>
          ) : exams.length === 0 ? (
            <EmptyState
              icon={<GraduationCap size={20} strokeWidth={1.75} aria-hidden />}
              title="لا توجد اختبارات منشورة"
              description="لم يتم طرح أي اختبارات إلكترونية في مقرراتك حتى الآن."
            />
          ) : (
            exams.map(({ course, item }) => (
              <Card key={item.id} className="p-4 space-y-2 bg-surface border border-border shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-primary font-bold px-2 py-0.5 rounded-xs bg-primary-subtle border border-primary/20">
                    {course.code}
                  </span>
                  <Badge variant="info">{item.duration_minutes || 60} دقيقة</Badge>
                </div>
                <h3 className="text-sm font-bold text-fg">{item.title}</h3>
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-fg-muted">
                  <span>الدرجة الكلية: {item.total_points || 100}</span>
                  <span className="text-primary font-medium">منشور للطلبة</span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Submissions List Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-lg overflow-hidden shadow-xl flex flex-col max-h-[90vh] text-start">
            <div className="px-6 py-4 border-b border-border bg-surface-raised flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-fg">تسليمات الطلبة: {selectedAssignment.item.title}</h3>
                <span className="text-xs text-fg-muted block mt-1">الدرجة العظمى: {selectedAssignment.item.points_possible} نقطة</span>
              </div>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="px-4 py-2 rounded-md bg-surface border border-border hover:bg-surface-raised text-fg text-xs font-semibold"
              >
                إغلاق
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {loadingSubmissions ? (
                <div className="text-center text-fg-muted py-12 text-sm">جارٍ تحميل التسليمات...</div>
              ) : submissions.length === 0 ? (
                <div className="text-center text-fg-muted py-12 text-sm">لا توجد تسليمات حتى الآن.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {submissions.map((sub) => (
                    <div key={sub.id} className="p-4 rounded-md border border-border bg-surface-raised flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-fg">{sub.student?.user?.name || 'طالب غير معروف'}</h4>
                          {sub.is_late && <Badge variant="danger">متأخر</Badge>}
                          {sub.status === 'graded' ? <Badge variant="success">تم التقييم</Badge> : <Badge variant="info">بانتظار التقييم</Badge>}
                        </div>
                        <p className="text-xs text-fg-muted mt-1">
                          تاريخ التسليم: {sub.submitted_at ? formatDateTime(sub.submitted_at) : '—'}
                        </p>
                        {sub.status === 'graded' && (
                          <p className="text-xs text-success mt-1 font-mono">
                            الدرجة: {sub.score} / {selectedAssignment.item.points_possible}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenGrading(sub)}
                        className="px-4 py-2 rounded-md bg-primary text-primary-fg hover:bg-primary-hover text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
                      >
                        {sub.status === 'graded' ? 'تعديل الدرجة' : 'عرض الإجابة والتقييم'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grade Submission Modal */}
      {activeSubmission && selectedAssignment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-lg overflow-hidden shadow-xl flex flex-col max-h-[90vh] text-start">
            <div className="px-6 py-4 border-b border-border bg-surface-raised flex items-center justify-between">
              <h3 className="text-base font-bold text-fg">
                تقييم إجابة الطالب: {activeSubmission.student?.user?.name || 'غير معروف'}
              </h3>
              <button
                onClick={() => setActiveSubmission(null)}
                className="text-fg-muted hover:text-fg text-sm font-bold"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-2">إجابة الطالب</label>
                <div className="p-4 rounded-md border border-border bg-surface-sunken text-fg whitespace-pre-wrap leading-relaxed">
                  {activeSubmission.content || 'لا يوجد نص مرفق (تم تسليم ملف).'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-fg-muted mb-1">الدرجة (من {selectedAssignment.item.points_possible})</label>
                  <input
                    type="number"
                    min="0"
                    max={selectedAssignment.item.points_possible}
                    value={gradeScore}
                    onChange={(e) => setGradeScore(Number(e.target.value))}
                    className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1">ملاحظات المعلم (اختياري)</label>
                <textarea aria-label="ملاحظات المعلم (اختياري)"
                  rows={3}
                  placeholder="اكتب تعليقاً على الإجابة لتوجيه الطالب..."
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-surface-raised flex items-center justify-end gap-3">
              <button
                onClick={() => setActiveSubmission(null)}
                className="px-4 py-2 rounded-md border border-border text-xs text-fg-muted hover:bg-surface hover:text-fg"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmitGrade}
                disabled={isGrading}
                className="px-6 py-2 rounded-md bg-primary hover:bg-primary-hover text-primary-fg font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
              >
                {isGrading ? 'جارٍ الحفظ...' : 'حفظ الدرجة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

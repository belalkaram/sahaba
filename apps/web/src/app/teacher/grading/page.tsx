'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { assessmentApi } from '../../../lib/assessment-api';
import { educationApi } from '../../../lib/education-api';
import type { AssignmentSubmission, Course, ExamAttempt, PendingGradingResponse } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { AlertCircleIcon, CheckCircleIcon, FileTextIcon, GraduationCapIcon } from '../../../components/icons';

import { X } from 'lucide-react';
import { formatDateTime, formatNumber, formatPercent } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function TeacherGradingInboxPage() {
  const [data, setData] = useState<PendingGradingResponse>({ count: 0, submissions: [], attempts: [] });
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'all' | 'assignment' | 'exam'>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Assignment Grading Modal State
  const [activeSubmission, setActiveSubmission] = useState<AssignmentSubmission | null>(null);
  const [assignScore, setAssignScore] = useState<number>(0);
  const [assignFeedback, setAssignFeedback] = useState('');
  const [assignPublishGrade, setAssignPublishGrade] = useState(true);
  const [submittingAssignGrade, setSubmittingAssignGrade] = useState(false);

  // Exam Attempt Grading Modal State
  const [activeAttempt, setActiveAttempt] = useState<ExamAttempt | null>(null);
  const [examScore, setExamScore] = useState<number>(0);
  const [examFeedback, setExamFeedback] = useState('');
  const [answersScores, setAnswersScores] = useState<Record<string, { points: number; feedback: string }>>({});
  const [submittingExamGrade, setSubmittingExamGrade] = useState(false);

  // Bulk Publish State
  const [bulkPublishing, setBulkPublishing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pending, cList] = await Promise.all([
        assessmentApi.getPendingGrading(),
        educationApi.getCourses().catch(partial([])),
      ]);
      setData(pending);
      setCourses(cList);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'فشل في تحميل صندوق التصحيح.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSubmissions = data.submissions.filter((sub) => {
    if (selectedType === 'exam') return false;
    if (selectedCourseId !== 'all' && sub.assignment?.course_id !== selectedCourseId) return false;
    return true;
  });

  const filteredAttempts = data.attempts.filter((att) => {
    if (selectedType === 'assignment') return false;
    if (selectedCourseId !== 'all' && att.exam?.course_id !== selectedCourseId) return false;
    return true;
  });

  const totalVisibleCount = filteredSubmissions.length + filteredAttempts.length;

  // Handle open assignment grading
  const handleOpenAssignGrade = (sub: AssignmentSubmission) => {
    setActiveSubmission(sub);
    setAssignScore(sub.score ?? 0);
    setAssignFeedback(sub.feedback || '');
    setAssignPublishGrade(true);
  };

  // Submit assignment grade
  const handleSubmitAssignGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmission) return;

    setSubmittingAssignGrade(true);
    try {
      await assessmentApi.gradeSubmission(
        activeSubmission.assignment?.course_id || '',
        activeSubmission.assignment_id,
        activeSubmission.id,
        assignScore,
        assignFeedback,
        assignPublishGrade
      );
      setActiveSubmission(null);
      setFeedback({ type: 'success', text: 'تم رصد واعتماد درجة الواجب بنجاح!' });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل رصد الدرجة.');
    } finally {
      setSubmittingAssignGrade(false);
    }
  };

  // Handle open exam attempt grading
  const handleOpenExamGrade = (att: ExamAttempt) => {
    setActiveAttempt(att);
    setExamScore(att.score ?? 0);
    setExamFeedback(att.feedback || '');

    // Map answers for per-question grading
    const initialMap: Record<string, { points: number; feedback: string }> = {};
    att.answers?.forEach((ans) => {
      initialMap[ans.question_id] = {
        points: ans.awarded_points ?? 0,
        feedback: ans.feedback || '',
      };
    });
    setAnswersScores(initialMap);
  };

  // Submit exam attempt grade
  const handleSubmitExamGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAttempt) return;

    setSubmittingExamGrade(true);
    try {
      const answersScoresPayload = Object.entries(answersScores).map(([qId, val]) => ({
        question_id: qId,
        awarded_points: val.points,
        feedback: val.feedback,
      }));

      await assessmentApi.gradeExamAttempt(
        activeAttempt.exam?.course_id || '',
        activeAttempt.exam_id,
        activeAttempt.id,
        {
          score: examScore,
          feedback: examFeedback,
          answers_scores: answersScoresPayload,
        }
      );

      setActiveAttempt(null);
      setFeedback({ type: 'success', text: 'تم رصد درجات الامتحان بنجاح!' });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل رصد درجات الامتحان.');
    } finally {
      setSubmittingExamGrade(false);
    }
  };

  // Bulk Publish
  const handleBulkPublish = async () => {
    const examIds = Array.from(new Set(data.attempts.map((a) => a.exam_id)));
    const assignIds = Array.from(new Set(data.submissions.map((s) => s.assignment_id)));

    if (examIds.length === 0 && assignIds.length === 0) return;
    if (!confirm('هل أنت متأكد من نشر جميع درجات التقييمات للطلاب دفعة واحدة؟')) return;

    setBulkPublishing(true);
    try {
      const res = await assessmentApi.bulkPublishGrades({
        exam_ids: examIds,
        assignment_ids: assignIds,
      });
      setFeedback({ type: 'success', text: `تم نشر الدرجات لـ ${res.published_count} تقييماً بنجاح!` });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل النشر الجماعي للدرجات.');
    } finally {
      setBulkPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-secondary mb-1">
            <Link href="/teacher/dashboard" className="hover:text-primary">
              لوحة التحكم
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">صندوق تصحيح التقييمات</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-foreground">صندوق التصحيح والتقييم الأكاديمي</h1>
            <Badge variant={data.count > 0 ? 'warning' : 'success'}>
              {data.count} بانتظار التصحيح
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data.count > 0 && (
            <button
              onClick={handleBulkPublish}
              disabled={bulkPublishing}
              className="px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {bulkPublishing ? 'جارٍ النشر...' : 'نشر جميع الدرجات المعتمدة'}
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[14px] text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-primary-subtle text-primary border border-primary/30' : 'bg-danger-subtle text-danger border border-danger/30'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircleIcon className="w-4 h-4 text-primary" /> : <AlertCircleIcon className="w-4 h-4 text-danger" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Filter Tabs & Course Dropdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-3 rounded-lg border border-border">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-colors ${
              selectedType === 'all' ? 'bg-primary text-primary-fg' : 'text-secondary hover:text-foreground'
            }`}
          >
            الكل ({data.count})
          </button>
          <button
            onClick={() => setSelectedType('assignment')}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-colors ${
              selectedType === 'assignment' ? 'bg-primary text-primary-fg' : 'text-secondary hover:text-foreground'
            }`}
          >
            واجبات دراسية ({formatNumber(data.submissions.length)})
          </button>
          <button
            onClick={() => setSelectedType('exam')}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-colors ${
              selectedType === 'exam' ? 'bg-primary text-primary-fg' : 'text-secondary hover:text-foreground'
            }`}
          >
            امتحانات تحتاج تصحيح ({formatNumber(data.attempts.length)})
          </button>
        </div>

        {courses.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-secondary font-bold shrink-0">المقرر:</span>
            <select
              aria-label="تصفية حسب المقرر"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-border bg-surface text-fg text-xs font-medium focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer w-full sm:w-auto"
            >
              <option className="bg-surface text-fg py-1.5" value="all">جميع المقررات</option>
              {courses.map((c) => (
                <option className="bg-surface text-fg py-1.5" key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pending Items List */}
      {totalVisibleCount === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <CheckCircleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">صندوق التصحيح فارغ تماماً!</h3>
            <p className="text-xs text-secondary mt-1">
              تم تصحيح واعتماد جميع تسليمات الواجبات والامتحانات الحالية.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* ASSIGNMENTS LIST */}
          {filteredSubmissions.map((sub) => (
            <Card key={sub.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileTextIcon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="neutral">واجب دراسي</Badge>
                    <span className="text-xs font-bold text-primary">{sub.assignment?.course?.title || 'المقرر'}</span>
                    {sub.is_late && <Badge variant="danger">تسليم متأخر</Badge>}
                    {sub.file_name && <Badge variant="info">مرفق ملف</Badge>}
                  </div>
                  <h3 className="font-bold text-foreground text-sm">{sub.assignment?.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-secondary">
                    <span className="font-semibold text-foreground">{sub.student?.user?.name || 'طالب'}</span>
                    <span>•</span>
                    <span>تاريخ التسليم: {sub.submitted_at ? formatDateTime(sub.submitted_at) : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => handleOpenAssignGrade(sub)}
                  className="px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover transition-colors shadow-sm"
                >
                  تصحيح ورصد الدرجة
                </button>
              </div>
            </Card>
          ))}

          {/* EXAMS ATTEMPTS LIST */}
          {filteredAttempts.map((att) => (
            <Card key={att.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-warning/10 text-warning flex items-center justify-center shrink-0">
                  <GraduationCapIcon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="warning">امتحان (أسئلة مقالية)</Badge>
                    <span className="text-xs font-bold text-primary">{att.exam?.course?.title || 'المقرر'}</span>
                    <Badge variant="neutral">محاولة #{att.attempt_number}</Badge>
                  </div>
                  <h3 className="font-bold text-foreground text-sm">{att.exam?.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-secondary">
                    <span className="font-semibold text-foreground">{att.student?.user?.name || 'طالب'}</span>
                    <span>•</span>
                    <span>تاريخ التسليم: {att.submitted_at ? formatDateTime(att.submitted_at) : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => handleOpenExamGrade(att)}
                  className="px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover transition-colors shadow-sm"
                >
                  تصحيح الأسئلة المقالية
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ASSIGNMENT GRADING MODAL */}
      {activeSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-black text-foreground text-base">تصحيح واجب: {activeSubmission.assignment?.title}</h3>
                <p className="text-xs text-secondary">الطالب: {activeSubmission.student?.user?.name}</p>
              </div>
              <button onClick={() => setActiveSubmission(null)} className="text-secondary hover:text-foreground" aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            {/* Late Warning */}
            {activeSubmission.is_late && (
              <div className="p-3 rounded-md bg-danger-subtle text-danger border border-danger/30 text-xs font-medium flex items-center gap-2">
                <AlertCircleIcon className="w-4 h-4 shrink-0 text-danger" />
                <span>
                  هذا الواجب تم تسليمه بعد انتهاء الموعد النهائي. تطبق سياسة التأخير المحددة بنسبة خصم{' '}
                  {formatPercent(activeSubmission.assignment?.late_penalty_percent ?? 0)}.
                </span>
              </div>
            )}

            {/* Submission Content Text */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-secondary">إجابة الطالب النصية:</label>
              <div className="p-3 rounded-md bg-background border border-border text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {activeSubmission.content || 'لا توجد إجابة نصية.'}
              </div>
            </div>

            {/* Attached File Download */}
            {activeSubmission.file_name && (
              <div className="p-3 rounded-md border border-border bg-background flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <FileTextIcon className="w-4 h-4 text-primary" />
                  <span className="font-bold text-foreground">{activeSubmission.file_name}</span>
                  {activeSubmission.file_size && (
                    <span className="text-secondary">({formatNumber(activeSubmission.file_size / 1024 / 1024, 2)} MB)</span>
                  )}
                </div>
                <a
                  href={assessmentApi.getSubmissionFileDownloadUrl(
                    activeSubmission.assignment?.course_id || '',
                    activeSubmission.assignment_id,
                    activeSubmission.id
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded-sm bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover"
                >
                  تحميل الملف
                </a>
              </div>
            )}

            {/* Grading Form */}
            <form onSubmit={handleSubmitAssignGrade} className="space-y-4 pt-2 border-t border-border text-xs">
              <div>
                <label className="block font-bold text-secondary mb-1">
                  الدرجة المستحقة (من {activeSubmission.assignment?.points_possible})
                </label>
                <input
                  type="number"
                  min={0}
                  max={activeSubmission.assignment?.points_possible || 100}
                  step={0.5}
                  value={assignScore}
                  onChange={(e) => setAssignScore(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-base font-bold text-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">ملاحظات وتعليقات المعلم للطالب</label>
                <textarea aria-label="ملاحظات وتعليقات المعلم للطالب"
                  rows={3}
                  value={assignFeedback}
                  onChange={(e) => setAssignFeedback(e.target.value)}
                  placeholder="اكتب التقييم والتعليقات التوجيهية..."
                  className="w-full p-2.5 rounded-md border border-border bg-background text-xs"
                ></textarea>
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={assignPublishGrade}
                  onChange={(e) => setAssignPublishGrade(e.target.checked)}
                  className="rounded-xs text-primary"
                />
                <span>نشر الدرجة وإتاحتها للطالب فور الحفظ</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveSubmission(null)}
                  className="px-4 py-2 rounded-md border border-border text-secondary hover:text-foreground font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingAssignGrade}
                  className="px-5 py-2 rounded-md bg-primary text-primary-fg font-bold hover:bg-primary-hover disabled:opacity-50"
                >
                  {submittingAssignGrade ? 'جارٍ الحفظ...' : 'اعتماد ورصد الدرجة'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* EXAM ATTEMPT GRADING MODAL */}
      {activeAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-black text-foreground text-base">تصحيح امتحان: {activeAttempt.exam?.title}</h3>
                <p className="text-xs text-secondary">
                  الطالب: {activeAttempt.student?.user?.name} • إجمالي درجات الامتحان: {activeAttempt.exam?.total_points}
                </p>
              </div>
              <button onClick={() => setActiveAttempt(null)} className="text-secondary hover:text-foreground" aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <form onSubmit={handleSubmitExamGrade} className="space-y-4 text-xs">
              {/* Question Answers Review */}
              <div className="space-y-3 max-h-80 overflow-y-auto ps-1">
                {activeAttempt.answers?.map((ans, idx) => {
                  const isEssay = ans.question?.question_type === 'essay';
                  return (
                    <div key={ans.id} className="p-3.5 rounded-md bg-background border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">السؤال {idx + 1} ({ans.question?.points} درجات)</span>
                        <Badge variant={isEssay ? 'warning' : ans.is_correct ? 'success' : 'danger'}>
                          {isEssay ? 'مقالي (يتطلب تقييمك)' : ans.is_correct ? 'صحيح (آلي)' : 'غير صحيح (آلي)'}
                        </Badge>
                      </div>

                      <p className="text-xs text-foreground font-medium">{ans.question?.question_text}</p>

                      <div className="p-2.5 rounded-sm bg-surface border border-border text-xs leading-relaxed">
                        <span className="font-bold text-secondary">إجابة الطالب: </span>
                        <span>{ans.answer_text || 'لم يتم تقديم إجابة.'}</span>
                      </div>

                      {/* Essay specific score input */}
                      {isEssay && (
                        <div className="pt-2 grid grid-cols-2 gap-2 border-t border-border">
                          <div>
                            <label className="block font-bold text-secondary mb-1">
                              الدرجة الممنوحة (من {ans.question?.points})
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={ans.question?.points || 10}
                              step={0.5}
                              value={answersScores[ans.question_id]?.points ?? 0}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setAnswersScores({
                                  ...answersScores,
                                  [ans.question_id]: {
                                    points: val,
                                    feedback: answersScores[ans.question_id]?.feedback || '',
                                  },
                                });
                              }}
                              className="w-full px-2.5 py-1.5 rounded-sm border border-border bg-background font-bold text-primary"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-secondary mb-1">ملاحظة على الإجابة</label>
                            <input aria-label="ملاحظة على الإجابة"
                              type="text"
                              value={answersScores[ans.question_id]?.feedback ?? ''}
                              onChange={(e) => {
                                setAnswersScores({
                                  ...answersScores,
                                  [ans.question_id]: {
                                    points: answersScores[ans.question_id]?.points || 0,
                                    feedback: e.target.value,
                                  },
                                });
                              }}
                              placeholder="توجيه أو تعليق..."
                              className="w-full px-2.5 py-1.5 rounded-sm border border-border bg-background"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Overall Exam Score Input */}
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-secondary mb-1">
                    الدرجة الإجمالية النهائية (من {activeAttempt.exam?.total_points})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={activeAttempt.exam?.total_points || 100}
                    step={0.5}
                    value={examScore}
                    onChange={(e) => setExamScore(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-base font-bold text-primary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-secondary mb-1">التقييم العام للمحاولة</label>
                  <textarea aria-label="التقييم العام للمحاولة"
                    rows={2}
                    value={examFeedback}
                    onChange={(e) => setExamFeedback(e.target.value)}
                    placeholder="ملاحظات شاملة على أداء الطالب في الامتحان..."
                    className="w-full p-2 rounded-md border border-border bg-background"
                  ></textarea>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveAttempt(null)}
                  className="px-4 py-2 rounded-md border border-border text-secondary hover:text-foreground font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingExamGrade}
                  className="px-5 py-2 rounded-md bg-primary text-primary-fg font-bold hover:bg-primary-hover disabled:opacity-50"
                >
                  {submittingExamGrade ? 'جارٍ الحفظ...' : 'اعتماد ورصد درجات الامتحان'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

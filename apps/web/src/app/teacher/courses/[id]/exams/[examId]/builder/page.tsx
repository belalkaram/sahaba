'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { assessmentApi } from '@/lib/assessment-api';
import { educationApi } from '@/lib/education-api';
import type { Course, Exam, ExamQuestion, QuestionBank, BankQuestion } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircleIcon, ClockIcon, FileTextIcon, PlusIcon, TrashIcon, AlertCircleIcon, BookOpenIcon, ShieldIcon } from '@/components/icons';

import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { formatNumber } from '../../../../../../../lib/format';
import { QuestionMediaFields, EMPTY_MEDIA_CHANGES, applyMediaChanges, hasMediaChanges, type MediaChanges } from '../../../../../../../features/assessment/question-media-fields';
import { ModelAnswerReleasePanel } from '../../../../../../../features/assessment/model-answer-release-panel';
import { partial } from '../../../../../../../lib/partial-failure';
interface PageProps {
  params: Promise<{
    id: string;
    examId: string;
  }>;
}

export default function ExamBuilderPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;
  const examId = resolvedParams.examId;
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settings Panel State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [passingScore, setPassingScore] = useState<number | ''>('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [showResults, setShowResults] = useState<'after_submit' | 'after_publish' | 'never'>('after_publish');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [splitSessions, setSplitSessions] = useState(false);

  // Question Modal State (Add/Edit)
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay'>('multiple_choice');
  const [qPoints, setQPoints] = useState(10);
  const [qOptions, setQOptions] = useState<string[]>(['الخيار الأول', 'الخيار الثاني']);
  const [qCorrectAnswer, setQCorrectAnswer] = useState('الخيار الأول');
  const [qAcceptableAnswers, setQAcceptableAnswers] = useState('');
  const [qExplanation, setQExplanation] = useState('');
  const [qModelAnswer, setQModelAnswer] = useState('');
  const [qMedia, setQMedia] = useState<MediaChanges>(EMPTY_MEDIA_CHANGES);

  // Bank Import Modal State
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [selectedBankQIds, setSelectedBankQIds] = useState<string[]>([]);
  const [importingFromBank, setImportingFromBank] = useState(false);

  // Student Preview Mode
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [c, examData, qList, banks] = await Promise.all([
        educationApi.getCourse(courseId).catch(partial(null)),
        assessmentApi.getExam(courseId, examId),
        assessmentApi.getExamQuestions(courseId, examId, true).catch(partial([])),
        assessmentApi.getQuestionBanks(courseId).catch(partial([])),
      ]);

      setCourse(c);
      const ex = examData.exam;
      setExam(ex);
      setQuestions(qList);
      setQuestionBanks(banks);

      // Populate form state
      setTitle(ex.title);
      setDescription(ex.description || '');
      setDurationMinutes(ex.duration_minutes || 60);
      setMaxAttempts(ex.max_attempts || 1);
      setPassingScore(ex.passing_score ?? '');
      setShuffleQuestions(Boolean(ex.shuffle_questions));
      setShuffleOptions(Boolean(ex.shuffle_options));
      setShowResults(ex.show_results || 'after_publish');
      setOpensAt(ex.opens_at ? ex.opens_at.slice(0, 16) : '');
      setClosesAt(ex.closes_at ? ex.closes_at.slice(0, 16) : '');
      setSplitSessions(Boolean(ex.allow_split_sessions));
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'فشل في تحميل بيانات الامتحان.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId, examId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      const updated = await assessmentApi.updateExam(courseId, examId, {
        title,
        description: description || undefined,
        duration_minutes: Number(durationMinutes),
        max_attempts: Number(maxAttempts),
        passing_score: passingScore !== '' ? Number(passingScore) : undefined,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        show_results: showResults,
        opens_at: opensAt ? new Date(opensAt).toISOString() : undefined,
        closes_at: closesAt ? new Date(closesAt).toISOString() : undefined,
        allow_split_sessions: splitSessions,
      });
      setExam(updated);
      setFeedback({ type: 'success', text: 'تم حفظ إعدادات الامتحان بنجاح.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'فشل حفظ الإعدادات.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePublishExam = async () => {
    setFeedback(null);
    try {
      const updated = await assessmentApi.publishExam(courseId, examId);
      setExam(updated);
      setFeedback({ type: 'success', text: 'تم نشر الامتحان بنجاح! يمكن للطلاب الآن أداء الامتحان.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'لا يمكن نشر الامتحان. تأكد من وجود سؤال واحد على الأقل وإجمالي درجات أكبر من صفر.' });
    }
  };

  const handleCloseExam = async () => {
    try {
      const updated = await assessmentApi.closeExam(courseId, examId);
      setExam(updated);
      setFeedback({ type: 'success', text: 'تم إغلاق الامتحان ومنع المحاولات الجديدة.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'فشل إغلاق الامتحان.' });
    }
  };

  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setQText('');
    setQType('multiple_choice');
    setQPoints(10);
    setQOptions(['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث']);
    setQCorrectAnswer('الخيار الأول');
    setQAcceptableAnswers('');
    setQExplanation('');
    setQModelAnswer('');
    setQMedia(EMPTY_MEDIA_CHANGES);
    setIsQuestionModalOpen(true);
  };

  const handleOpenEditQuestion = (q: ExamQuestion) => {
    setEditingQuestion(q);
    setQText(q.question_text);
    setQType(q.question_type);
    setQPoints(q.points);
    setQOptions(q.options && q.options.length > 0 ? q.options : ['نعم', 'لا']);
    setQCorrectAnswer(q.correct_answer || '');
    setQAcceptableAnswers(q.acceptable_answers ? q.acceptable_answers.join(', ') : '');
    setQExplanation(q.explanation || '');
    setQModelAnswer(q.model_answer || '');
    setQMedia(EMPTY_MEDIA_CHANGES);
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText.trim()) return;

    try {
      const acceptableArr = qAcceptableAnswers
        ? qAcceptableAnswers.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      let savedId = '';
      if (editingQuestion) {
        const updated = await assessmentApi.updateExamQuestion(courseId, examId, editingQuestion.id, {
          question_text: qText,
          question_type: qType,
          points: qPoints,
          options: qType === 'multiple_choice' || qType === 'multiple_select' ? qOptions : undefined,
          correct_answer: qType === 'true_false' || qType === 'multiple_choice' || qType === 'short_answer' ? qCorrectAnswer : undefined,
          acceptable_answers: acceptableArr,
          explanation: qExplanation || undefined,
          model_answer: qModelAnswer,
        });
        savedId = updated.id;
        setQuestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await assessmentApi.addExamQuestion(courseId, examId, {
          question_text: qText,
          question_type: qType,
          points: qPoints,
          options: qType === 'multiple_choice' || qType === 'multiple_select' ? qOptions : undefined,
          correct_answer: qType === 'true_false' || qType === 'multiple_choice' || qType === 'short_answer' ? qCorrectAnswer : undefined,
          acceptable_answers: acceptableArr,
          explanation: qExplanation || undefined,
          model_answer: qModelAnswer || undefined,
        });
        savedId = created.id;
        setQuestions((prev) => [...prev, created]);
      }

      // Images need the saved question's id, so they are uploaded after it.
      if (savedId && hasMediaChanges(qMedia)) {
        try {
          await applyMediaChanges(courseId, 'exams', examId, savedId, qMedia);
        } catch {
          alert('حُفظ السؤال لكن تعذّر رفع الصورة. افتح السؤال وأعد المحاولة (JPG/PNG/WebP حتى 3 ميجابايت).');
        }
        setQuestions(await assessmentApi.getExamQuestions(courseId, examId, true).catch(() => questions));
      }

      // Reload exam to get updated total_points
      const exRes = await assessmentApi.getExam(courseId, examId);
      setExam(exRes.exam);

      setIsQuestionModalOpen(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل حفظ السؤال.');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    try {
      await assessmentApi.deleteExamQuestion(courseId, examId, qId);
      setQuestions((prev) => prev.filter((item) => item.id !== qId));
      const exRes = await assessmentApi.getExam(courseId, examId);
      setExam(exRes.exam);
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل حذف السؤال.');
    }
  };

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const reordered = [...questions];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    setQuestions(reordered);

    const items = reordered.map((q, idx) => ({ id: q.id, sort_order: idx + 1 }));
    try {
      await assessmentApi.reorderExamQuestions(courseId, examId, items);
    } catch {
      // Revert if error
      loadData();
    }
  };

  // Question Bank Import Logic
  const handleOpenBankModal = async () => {
    setIsBankModalOpen(true);
    if (questionBanks.length > 0 && !selectedBankId) {
      setSelectedBankId(questionBanks[0].id);
      loadBankQuestions(questionBanks[0].id);
    }
  };

  const loadBankQuestions = async (bankId: string) => {
    try {
      const res = await assessmentApi.getQuestionBank(courseId, bankId);
      setBankQuestions(res.questions ?? []);
      setSelectedBankQIds([]);
    } catch {
      setBankQuestions([]);
    }
  };

  const handleImportSelectedBankQuestions = async () => {
    if (!selectedBankId || selectedBankQIds.length === 0) return;
    setImportingFromBank(true);
    try {
      await assessmentApi.importBankQuestionsToExam(courseId, examId, selectedBankId, selectedBankQIds);
      await loadData();
      setIsBankModalOpen(false);
      setFeedback({ type: 'success', text: `تم استيراد ${selectedBankQIds.length} سؤال بنجاح من بنك الأسئلة!` });
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل استيراد الأسئلة من البنك.');
    } finally {
      setImportingFromBank(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-secondary">الامتحان غير موجود أو تم حذفه.</p>
        <Link href={`/teacher/courses/${courseId}`} className="text-primary hover:underline font-bold">
          العودة للمقرر
        </Link>
      </div>
    );
  }

  const canPublish = questions.length >= 1 && questions.reduce((sum, q) => sum + Number(q.points), 0) > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Breadcrumb & Status Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-secondary mb-1">
            <Link href="/teacher/courses" className="hover:text-primary">
              المقررات
            </Link>
            <span>/</span>
            <Link href={`/teacher/courses/${courseId}`} className="hover:text-primary">
              {course?.title || 'المقرر'}
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold">منشئ الامتحانات (Exam Builder)</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-foreground">{exam.title}</h1>
            <Badge
              variant={
                exam.status === 'published'
                  ? 'success'
                  : exam.status === 'closed'
                  ? 'warning'
                  : exam.status === 'archived'
                  ? 'danger'
                  : 'neutral'
              }
            >
              {exam.status === 'published'
                ? 'منشور'
                : exam.status === 'closed'
                ? 'مغلق'
                : exam.status === 'archived'
                ? 'مؤرشف'
                : 'مسودة (Draft)'}
            </Badge>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`px-3 py-1.5 rounded-[12px] text-xs font-bold border transition-colors ${
              isPreviewMode ? 'bg-primary text-primary-fg border-primary' : 'bg-surface text-secondary border-border hover:bg-background'
            }`}
          >
            {isPreviewMode ? 'الخروج من المعاينة' : 'معاينة كطالب'}
          </button>

          {exam.status !== 'published' ? (
            <button
              onClick={handlePublishExam}
              disabled={!canPublish}
              className={`px-4 py-1.5 rounded-[12px] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                canPublish
                  ? 'bg-success hover:bg-success/90 text-success-fg cursor-pointer'
                  : 'bg-muted text-muted-foreground opacity-60 cursor-not-allowed'
              }`}
            >
              <CheckCircleIcon className="w-4 h-4" />
              نشر الامتحان للطلاب
            </button>
          ) : (
            <button
              onClick={handleCloseExam}
              className="px-4 py-1.5 rounded-md text-xs font-bold bg-warning hover:bg-warning/90 text-warning-fg transition-all shadow-sm"
            >
              إغلاق الامتحان
            </button>
          )}

          <Link
            href={`/teacher/courses/${courseId}`}
            className="px-3 py-1.5 rounded-md text-xs font-bold border border-border text-secondary hover:text-foreground"
          >
            خروج
          </Link>
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

      {/* STUDENT PREVIEW MODE */}
      {isPreviewMode ? (
        <div className="space-y-6">
          <div className="bg-warning/10 border border-warning/20 p-4 rounded-xl text-warning dark:text-warning flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldIcon className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold text-sm">وضع معاينة الطالب التجريبي (Student Preview Mode)</p>
                <p className="text-xs opacity-90">هكذا يظهر الامتحان للطالب مع المؤقت الزمني وترتيب الأسئلة.</p>
              </div>
            </div>
            <button onClick={() => setIsPreviewMode(false)} className="text-xs font-bold underline">
              الرجوع للتعديل
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              {questions.map((q, idx) => (
                <Card key={q.id} className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-secondary">السؤال {idx + 1}</span>
                    <Badge variant="neutral">{q.points} درجات</Badge>
                  </div>
                  <p className="font-bold text-foreground text-base">{q.question_text}</p>

                  {/* Multiple Choice Preview */}
                  {q.question_type === 'multiple_choice' && (
                    <div className="space-y-2 pt-2">
                      {q.options?.map((opt, oIdx) => (
                        <label key={oIdx} className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-background cursor-pointer">
                          <input type="radio" name={`preview_${q.id}`} className="text-primary focus:ring-primary" />
                          <span className="text-sm font-medium">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Multiple Select Preview */}
                  {q.question_type === 'multiple_select' && (
                    <div className="space-y-2 pt-2">
                      {q.options?.map((opt, oIdx) => (
                        <label key={oIdx} className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-background cursor-pointer">
                          <input type="checkbox" className="rounded-xs text-primary focus:ring-primary" />
                          <span className="text-sm font-medium">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* True / False Preview */}
                  {q.question_type === 'true_false' && (
                    <div className="flex gap-4 pt-2">
                      <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border border-border hover:bg-background cursor-pointer font-bold text-sm">
                        <input type="radio" name={`preview_${q.id}`} />
                        <span>صح (True)</span>
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border border-border hover:bg-background cursor-pointer font-bold text-sm">
                        <input type="radio" name={`preview_${q.id}`} />
                        <span>خطأ (False)</span>
                      </label>
                    </div>
                  )}

                  {/* Short Answer Preview */}
                  {q.question_type === 'short_answer' && (
                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder="اكتب إجابتك هنا..."
                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm"
                        disabled
                      />
                    </div>
                  )}

                  {/* Essay Preview */}
                  {q.question_type === 'essay' && (
                    <div className="pt-2">
                      <textarea
                        rows={4}
                        placeholder="اكتب إجابتك المقالية بالتفصيل هنا..."
                        className="w-full p-3 rounded-lg border border-border bg-background text-sm"
                        disabled
                      ></textarea>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Preview Sidebar */}
            <div className="space-y-4">
              <Card className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <ClockIcon className="w-5 h-5" />
                  <span>الوقت المتبقي: {durationMinutes}:00</span>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-secondary mb-2">خريطة الأسئلة:</p>
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((_, i) => (
                      <div key={i} className="h-8 rounded-sm bg-background border border-border flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        /* BUILDER WORKSPACE (EDIT MODE) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Questions Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">أسئلة الامتحان ({formatNumber(questions.length)})</h2>
                <p className="text-xs text-secondary">إجمالي الدرجات: {questions.reduce((sum, q) => sum + Number(q.points), 0)} درجة</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenBankModal}
                  className="px-3 py-1.5 rounded-md text-xs font-bold border border-primary/40 text-primary hover:bg-primary/5 flex items-center gap-1.5 transition-colors"
                >
                  <BookOpenIcon className="w-4 h-4" />
                  استيراد من بنك الأسئلة
                </button>
                <button
                  onClick={handleOpenAddQuestion}
                  className="px-3.5 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-fg hover:bg-primary/90 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                  إضافة سؤال جديد
                </button>
              </div>
            </div>

            {/* Questions List */}
            {questions.length === 0 ? (
              <Card className="p-12 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <FileTextIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">لم يتم إضافة أسئلة بعد</h3>
                  <p className="text-xs text-secondary mt-1">
                    أضف أسئلة جديدة أو استورد مجموعة من بنك الأسئلة الخاص بالمقرر للبدء.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleOpenAddQuestion}
                    className="px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold"
                  >
                    إضافة أول سؤال
                  </button>
                  <button
                    onClick={handleOpenBankModal}
                    className="px-4 py-2 rounded-md border border-border text-xs font-bold hover:bg-background"
                  >
                    استيراد من البنك
                  </button>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <Card key={q.id} className="p-4 flex items-start justify-between gap-4 group hover:border-primary/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-sm bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">
                            {q.question_type === 'multiple_choice'
                              ? 'اختيار من متعدد'
                              : q.question_type === 'multiple_select'
                              ? 'اختيار متعدد الإجابات'
                              : q.question_type === 'true_false'
                              ? 'صح / خطأ'
                              : q.question_type === 'short_answer'
                              ? 'إجابة قصيرة'
                              : 'سؤال مقالي'}
                          </Badge>
                          <span className="text-xs font-bold text-secondary">{q.points} درجات</span>
                          {q.bank_id && <Badge variant="info">مستورد من البنك</Badge>}
                        </div>
                        <p className="font-bold text-foreground text-sm leading-relaxed">{q.question_text}</p>
                        {q.correct_answer && (
                          <p className="text-xs text-primary dark:text-primary font-medium">
                            الإجابة الصحيحة: {q.correct_answer}
                          </p>
                        )}
                        {q.acceptable_answers && q.acceptable_answers.length > 0 && (
                          <p className="text-xs text-secondary">
                            بدائل الإجابة: {q.acceptable_answers.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveQuestion(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded-sm text-secondary hover:text-foreground disabled:opacity-30"
                        title="تحريك لأعلى"
                      >
                        
 <ChevronUp size={16} strokeWidth={1.75} aria-hidden />
 </button>
                      <button
                        onClick={() => handleMoveQuestion(idx, 'down')}
                        disabled={idx === questions.length - 1}
                        className="p-1.5 rounded-sm text-secondary hover:text-foreground disabled:opacity-30"
                        title="تحريك لأسفل"
                      >
                        
 <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
 </button>
                      <button
                        onClick={() => handleOpenEditQuestion(q)}
                        className="p-1.5 rounded-sm text-secondary hover:text-primary text-xs font-bold"
                        title="تعديل السؤال"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-sm text-secondary hover:text-danger text-xs"
                        title="حذف السؤال"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Settings Sidebar Column */}
          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <h3 className="font-bold text-foreground text-sm border-b border-border pb-2">
                إعدادات وسياسة الامتحان
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-secondary mb-1">عنوان الامتحان</label>
                  <input aria-label="عنوان الامتحان"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-md border border-border bg-background font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-secondary mb-1">التعليمات والوصف</label>
                  <textarea aria-label="التعليمات والوصف"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2.5 rounded-md border border-border bg-background"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-secondary mb-1">المدة (بالدقائق)</label>
                    <input aria-label="المدة (بالدقائق)"
                      type="number"
                      min={1}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-md border border-border bg-background font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-secondary mb-1">أقصى محاولات</label>
                    <input aria-label="أقصى محاولات"
                      type="number"
                      min={1}
                      max={10}
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-md border border-border bg-background font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-secondary mb-1">درجة النجاح الأدنى (اختياري)</label>
                  <input aria-label="درجة النجاح الأدنى (اختياري)"
                    type="number"
                    min={0}
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background"
                    placeholder="مثال: 50"
                  />
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="rounded-xs text-primary"
                    />
                    <span>خلط ترتيب الأسئلة لكل طالب</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="rounded-xs text-primary"
                    />
                    <span>خلط خيارات الإجابة</span>
                  </label>
                </div>

                <div className="border-t border-border pt-3">
                  <label className="block font-bold text-secondary mb-1">عرض النتائج والإجابات للطلاب</label>
                  <select aria-label="عرض النتائج والإجابات للطلاب"
                    value={showResults}
                    onChange={(e: any) => setShowResults(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-surface text-fg text-xs focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
                  >
                    <option className="bg-surface text-fg py-1.5" value="after_publish">فقط بعد اعتماد ونشر الدرجات من المعلم</option>
                    <option className="bg-surface text-fg py-1.5" value="after_submit">مباشرة فور تسليم الامتحان</option>
                    <option className="bg-surface text-fg py-1.5" value="never">حجب التفاصيل (إظهار المجموع فقط)</option>
                  </select>
                </div>

                <div className="border-t border-border pt-3 grid grid-cols-1 gap-2">
                  <div>
                    <label className="block font-bold text-secondary mb-1">تاريخ ووقت الفتح (اختياري)</label>
                    <input aria-label="تاريخ ووقت الفتح (اختياري)"
                      type="datetime-local"
                      value={opensAt}
                      onChange={(e) => setOpensAt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-secondary mb-1">تاريخ ووقت الإغلاق النهائي</label>
                    <input aria-label="تاريخ ووقت الإغلاق النهائي"
                      type="datetime-local"
                      value={closesAt}
                      onChange={(e) => setClosesAt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-xs"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-1.5">
                  <label className="flex items-start gap-2 font-bold text-secondary">
                    <input type="checkbox" checked={splitSessions} onChange={(e) => setSplitSessions(e.target.checked)} className="mt-0.5" />
                    <span>السماح بحل الامتحان على أكثر من جلسة</span>
                  </label>
                  <p className="text-fg-muted leading-relaxed">
                    يستطيع الطالب أن يوزّع مدة الامتحان ({formatNumber(Number(durationMinutes))} دقيقة) على عدة جلسات داخل فترة الفتح والإغلاق أعلاه، ويُحتسب فقط الوقت الذي تكون فيه صفحة الامتحان مفتوحة.
                    {splitSessions && !(opensAt && closesAt) && <strong className="block text-warning">حدّد وقت الفتح والإغلاق لتتضح الفترة للطلاب.</strong>}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full py-2.5 rounded-md bg-primary text-primary-fg font-bold text-xs hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {savingSettings ? 'جارٍ الحفظ...' : 'حفظ إعدادات الامتحان'}
                </button>
              </form>
            </Card>

            {/* Publishing Readiness Checklist */}
            <Card className="p-4 space-y-2 text-xs">
              <h4 className="font-bold text-foreground">جاهزية النشر:</h4>
              <ul className="space-y-1.5 text-secondary">
                <li className="flex items-center gap-2">
                  <span className={questions.length >= 1 ? 'text-primary font-bold' : 'text-danger font-bold'}>
                    {questions.length >= 1 ? <Check size={16} strokeWidth={1.75} aria-hidden /> : <X size={16} strokeWidth={1.75} aria-hidden />}
                  </span>
                  <span>يحتوي على سؤال واحد على الأقل ({formatNumber(questions.length)})</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className={canPublish ? 'text-primary font-bold' : 'text-danger font-bold'}>
                    {canPublish ? <Check size={16} strokeWidth={1.75} aria-hidden /> : <X size={16} strokeWidth={1.75} aria-hidden />}
                  </span>
                  <span>إجمالي الدرجات أكبر من صفر</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-primary font-bold"><Check size={16} strokeWidth={1.75} aria-hidden /></span>
                  <span>مؤقت الامتحان محدد ({durationMinutes} دقيقة)</span>
                </li>
              </ul>
            </Card>

            <ModelAnswerReleasePanel courseId={courseId} kind="exams" itemId={examId} />
          </div>
        </div>
      )}

      {/* QUESTION MODAL (Add / Edit) */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-base font-black text-foreground">
              {editingQuestion ? 'تعديل السؤال' : 'إضافة سؤال جديد'}
            </h3>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-secondary mb-1">نوع السؤال</label>
                  <select aria-label="نوع السؤال"
                    value={qType}
                    onChange={(e: any) => setQType(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-surface text-fg text-xs focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
                  >
                    <option className="bg-surface text-fg py-1.5" value="multiple_choice">اختيار من متعدد (إجابة واحدة)</option>
                    <option className="bg-surface text-fg py-1.5" value="multiple_select">اختيار متعدد الإجابات</option>
                    <option className="bg-surface text-fg py-1.5" value="true_false">صح أو خطأ</option>
                    <option className="bg-surface text-fg py-1.5" value="short_answer">إجابة قصيرة (تصحيح آلي)</option>
                    <option className="bg-surface text-fg py-1.5" value="essay">سؤال مقالي (تصحيح يدوي)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-secondary mb-1">الدرجة المخصصة</label>
                  <input aria-label="الدرجة المخصصة"
                    type="number"
                    min={1}
                    value={qPoints}
                    onChange={(e) => setQPoints(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-md border border-border bg-background font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-secondary mb-1">نص السؤال</label>
                <textarea aria-label="نص السؤال"
                  rows={3}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  required
                  placeholder="اكتب صيغة السؤال هنا..."
                  className="w-full p-3 rounded-md border border-border bg-background text-sm"
                ></textarea>
              </div>

              {/* Multiple Choice Options */}
              {(qType === 'multiple_choice' || qType === 'multiple_select') && (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-secondary">خيارات الإجابة</label>
                    <button
                      type="button"
                      onClick={() => setQOptions([...qOptions, `الخيار ${qOptions.length + 1}`])}
                      className="text-primary hover:underline text-xs font-bold"
                    >
                      + إضافة خيار
                    </button>
                  </div>
                  {qOptions.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type={qType === 'multiple_choice' ? 'radio' : 'checkbox'}
                        name="correct_radio"
                        checked={qCorrectAnswer === opt}
                        onChange={() => setQCorrectAnswer(opt)}
                        className="text-primary"
                        title="تحديد كإجابة صحيحة"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...qOptions];
                          updated[oIdx] = e.target.value;
                          setQOptions(updated);
                          if (qCorrectAnswer === opt) setQCorrectAnswer(e.target.value);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-md border border-border bg-background"
                      />
                      {qOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setQOptions(qOptions.filter((_, idx) => idx !== oIdx))}
                          className="text-danger hover:text-danger p-1"
                         aria-label="إغلاق">
                          
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-secondary">حدد الدائرة بجانب الخيار الذي يمثل الإجابة الصحيحة.</p>
                </div>
              )}

              {/* True / False Selector */}
              {qType === 'true_false' && (
                <div className="border-t border-border pt-3 space-y-2">
                  <label className="font-bold text-secondary">الإجابة الصحيحة:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tf_answer"
                        value="true"
                        checked={qCorrectAnswer === 'true'}
                        onChange={() => setQCorrectAnswer('true')}
                      />
                      <span>صح (True)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tf_answer"
                        value="false"
                        checked={qCorrectAnswer === 'false'}
                        onChange={() => setQCorrectAnswer('false')}
                      />
                      <span>خطأ (False)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Short Answer Input & Synonyms */}
              {qType === 'short_answer' && (
                <div className="border-t border-border pt-3 space-y-3">
                  <div>
                    <label className="block font-bold text-secondary mb-1">الإجابة النموذجية النموذجية</label>
                    <input aria-label="الإجابة النموذجية النموذجية"
                      type="text"
                      value={qCorrectAnswer}
                      onChange={(e) => setQCorrectAnswer(e.target.value)}
                      required
                      placeholder="مثال: القاهرة"
                      className="w-full px-3 py-2 rounded-md border border-border bg-background font-bold text-primary"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-secondary mb-1">بدائل مقبولة أخرى (مفصولة بفاصلة)</label>
                    <input aria-label="بدائل مقبولة أخرى (مفصولة بفاصلة)"
                      type="text"
                      value={qAcceptableAnswers}
                      onChange={(e) => setQAcceptableAnswers(e.target.value)}
                      placeholder="مثال: مدينه القاهره, مدينه مصر"
                      className="w-full px-3 py-2 rounded-md border border-border bg-background"
                    />
                    <p className="text-xs text-secondary mt-1">
                      النظام يتجاهل المسافات الزائدة وحالة الأحرف تلقائياً أثناء التصحيح.
                    </p>
                  </div>
                </div>
              )}

              {/* Explanation Field */}
              <div className="border-t border-border pt-3">
                <label className="block font-bold text-secondary mb-1">تفسير الإجابة للطلاب (يظهر بعد نشر النتائج)</label>
                <textarea aria-label="تفسير الإجابة للطلاب (يظهر بعد نشر النتائج)"
                  rows={2}
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="اكتب التوضيح الأكاديمي للحل هنا..."
                  className="w-full p-2.5 rounded-md border border-border bg-background"
                ></textarea>
              </div>

              <div className="border-t border-border pt-3">
                <label className="block font-bold text-secondary mb-1">الحل النموذجي (يظهر للطالب فقط عندما تتيحه له)</label>
                <textarea aria-label="الحل النموذجي"
                  rows={3}
                  value={qModelAnswer}
                  onChange={(e) => setQModelAnswer(e.target.value)}
                  placeholder="اكتب الإجابة النموذجية أو خطوات الحل..."
                  className="w-full p-2.5 rounded-md border border-border bg-background"
                ></textarea>
              </div>

              <QuestionMediaFields
                value={qMedia}
                onChange={setQMedia}
                hasImage={Boolean(editingQuestion?.has_image)}
                hasModelImage={Boolean(editingQuestion?.has_model_answer_image)}
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="px-4 py-2 rounded-md border border-border text-secondary hover:text-foreground font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-primary text-primary-fg font-bold hover:bg-primary/90"
                >
                  حفظ السؤال
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* QUESTION BANK IMPORT MODAL */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-base font-black text-foreground">استيراد أسئلة من بنك الأسئلة</h3>

            {questionBanks.length === 0 ? (
              <div className="p-8 text-center text-secondary space-y-3">
                <p>لا توجد بنوك أسئلة منشأة لهذا المقرر حتى الآن.</p>
                <button
                  onClick={() => setIsBankModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-secondary mb-1">اختر بنك الأسئلة:</label>
                  <select aria-label="اختر بنك الأسئلة:"
                    value={selectedBankId}
                    onChange={(e) => {
                      setSelectedBankId(e.target.value);
                      loadBankQuestions(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-md border border-border bg-surface text-fg text-xs font-bold focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer"
                  >
                    {questionBanks.map((b) => (
                      <option className="bg-surface text-fg py-1.5" key={b.id} value={b.id}>
                        {b.title} ({b.questions_count ?? 0} سؤال)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between font-bold">
                    <span>الأسئلة المتوفرة بالبنك ({formatNumber(bankQuestions.length)}):</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedBankQIds.length === bankQuestions.length) {
                          setSelectedBankQIds([]);
                        } else {
                          setSelectedBankQIds(bankQuestions.map((q) => q.id));
                        }
                      }}
                      className="text-primary hover:underline"
                    >
                      {selectedBankQIds.length === bankQuestions.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 border border-border p-2 rounded-md">
                    {bankQuestions.map((bq) => (
                      <label
                        key={bq.id}
                        className="flex items-start gap-3 p-2.5 rounded-md bg-background hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBankQIds.includes(bq.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBankQIds([...selectedBankQIds, bq.id]);
                            } else {
                              setSelectedBankQIds(selectedBankQIds.filter((id) => id !== bq.id));
                            }
                          }}
                          className="mt-1 rounded-xs text-primary"
                        />
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground text-xs">{bq.question_text}</p>
                          <div className="flex items-center gap-2 text-xs text-secondary">
                            <span>{bq.question_type}</span>
                            <span>•</span>
                            <span>{bq.points} درجات</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsBankModalOpen(false)}
                    className="px-4 py-2 rounded-md border border-border text-secondary hover:text-foreground font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSelectedBankQuestions}
                    disabled={importingFromBank || selectedBankQIds.length === 0}
                    className="px-5 py-2 rounded-md bg-primary text-primary-fg font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {importingFromBank ? 'جارٍ الاستيراد...' : `استيراد (${selectedBankQIds.length}) سؤال إلى الامتحان`}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

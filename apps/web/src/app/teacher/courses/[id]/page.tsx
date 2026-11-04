'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  educationApi,
  CourseProgressOverview,
} from '../../../../lib/education-api';
import type { Course, Lesson } from '../../../../types';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';
import { ImageUploader } from '../../../../components/ui/image-uploader';
import { Modal } from '../../../../components/ui/modal';
import { Tabs } from '../../../../components/ui/tabs';
import { StatCard } from '../../../../components/ui/stat-card';
import { EmptyState } from '../../../../components/ui/empty-state';
import { SkeletonCard } from '../../../../components/ui/skeleton';
import { BookOpenIcon, VideoIcon, FileTextIcon, CheckCircleIcon, TrashIcon, UsersIcon, SettingsIcon, IconBack } from '../../../../components/icons';

import { X } from 'lucide-react';
import { IconExternal } from '../../../../components/icons/directional';
import { formatDateTime, formatNumber, formatPercent } from '../../../../lib/format';
import { partial } from '../../../../lib/partial-failure';
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TeacherCourseBuilderPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [progressOverview, setProgressOverview] = useState<CourseProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'outline' | 'settings' | 'students'>('outline');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal States
  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDesc, setModuleDesc] = useState('');

  const [isAddLessonModalOpen, setIsAddLessonModalOpen] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonType, setLessonType] = useState<'video' | 'document' | 'text' | 'assignment' | 'exam' | 'live'>('video');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [isFreePreview, setIsFreePreview] = useState(false);

  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);
  const [targetLessonId, setTargetLessonId] = useState<string | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialKind, setMaterialKind] = useState<'file' | 'link'>('file');
  const [materialUrl, setMaterialUrl] = useState('');
  const [materialFile, setMaterialFile] = useState<File | null>(null);

  // Course Settings Form
  const [settingsForm, setSettingsForm] = useState({
    title: '',
    code: '',
    description: '',
    level: 'intermediate' as 'beginner' | 'intermediate' | 'advanced',
    is_free: false,
    is_public: false,
    status: 'draft' as 'draft' | 'published' | 'archived',
  });
  const [coverVersion, setCoverVersion] = useState(0);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCourseData = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const [outlineData, progressData] = await Promise.all([
        educationApi.getCourseOutline(id),
        educationApi.getCourseProgress(id).catch(partial(null)),
      ]);
      setCourse(outlineData);
      setProgressOverview(progressData);
      setSettingsForm({
        title: outlineData.title,
        code: outlineData.code || '',
        description: outlineData.description || '',
        level: (outlineData.level as 'beginner' | 'intermediate' | 'advanced') || 'intermediate',
        is_free: Boolean(outlineData.is_free),
        is_public: Boolean(outlineData.is_public),
        status: (outlineData.status as 'draft' | 'published' | 'archived') || 'draft',
      });
    } catch {
      setFeedback({ type: 'error', text: 'فشل في تحميل بيانات المقرر ومخطط المحتوى.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourseData();
  }, [id]);

  // Actions: Module
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;
    try {
      setIsSubmitting(true);
      await educationApi.createModule(id, {
        title: moduleTitle.trim(),
        description: moduleDesc.trim() || undefined,
      });
      setIsAddModuleModalOpen(false);
      setModuleTitle('');
      setModuleDesc('');
      setFeedback({ type: 'success', text: 'تمت إضافة الوحدة التعليمية بنجاح.' });
      loadCourseData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء إنشاء الوحدة.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الوحدة وجميع الدروس التابعة لها؟')) return;
    try {
      await educationApi.deleteModule(moduleId);
      setFeedback({ type: 'success', text: 'تم حذف الوحدة بنجاح.' });
      loadCourseData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء حذف الوحدة.' });
    }
  };

  // Actions: Lesson
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;
    try {
      setIsSubmitting(true);
      await educationApi.createLesson(id, {
        module_id: targetModuleId,
        title: lessonTitle.trim(),
        content: lessonContent.trim() || undefined,
        type: lessonType,
        duration_seconds: durationMinutes * 60,
        is_free_preview: isFreePreview,
        status: 'published',
      });
      setIsAddLessonModalOpen(false);
      setLessonTitle('');
      setLessonContent('');
      setTargetModuleId(null);
      setFeedback({ type: 'success', text: 'تمت إضافة الدرس بنجاح.' });
      loadCourseData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء إضافة الدرس.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الدرس ومرفقاته؟')) return;
    try {
      await educationApi.deleteLesson(lessonId);
      setFeedback({ type: 'success', text: 'تم حذف الدرس بنجاح.' });
      loadCourseData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء حذف الدرس.' });
    }
  };

  const handleTogglePublishLesson = async (lesson: Lesson) => {
    try {
      if (lesson.status === 'published') {
        await educationApi.unpublishLesson(lesson.id);
        setFeedback({ type: 'success', text: 'تم تحويل الدرس إلى مسودة.' });
      } else {
        await educationApi.publishLesson(lesson.id);
        setFeedback({ type: 'success', text: 'تم نشر الدرس بنجاح.' });
      }
      loadCourseData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء تغيير حالة الدرس.' });
    }
  };

  // Actions: Material
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLessonId || !materialTitle.trim()) return;
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('title', materialTitle.trim());
      formData.append('kind', materialKind);
      if (materialKind === 'file' && materialFile) {
        formData.append('file', materialFile);
      } else if (materialKind === 'link' && materialUrl.trim()) {
        formData.append('url', materialUrl.trim());
      }

      await educationApi.createMaterial(targetLessonId, formData);
      setIsAddMaterialModalOpen(false);
      setMaterialTitle('');
      setMaterialUrl('');
      setMaterialFile(null);
      setTargetLessonId(null);
      setFeedback({ type: 'success', text: 'تمت إضافة المرفق التعليمي بنجاح.' });
      loadCourseData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء رفع المرفق التعليمي.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المرفق؟')) return;
    try {
      await educationApi.deleteMaterial(materialId);
      setFeedback({ type: 'success', text: 'تم حذف المرفق بنجاح.' });
      loadCourseData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء حذف المرفق.' });
    }
  };

  // Actions: Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      await educationApi.updateCourse(id, settingsForm);
      setFeedback({ type: 'success', text: 'تم حفظ إعدادات المقرر بنجاح.' });
      loadCourseData();
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء تحديث بيانات المقرر.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!confirm('تحذير: هل أنت متأكد من حذف المقرر بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      await educationApi.deleteCourse(id);
      router.push('/teacher/courses');
    } catch {
      setFeedback({ type: 'error', text: 'حدث خطأ أثناء حذف المقرر.' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto py-8">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <p className="text-secondary">المقرر المطلوب غير موجود أو تم حذفه.</p>
        <Link href="/teacher/courses">
          <Button variant="secondary">العودة لقائمة المقررات</Button>
        </Link>
      </div>
    );
  }

  const totalLessons = course.modules?.reduce((acc, m) => acc + (m.lessons?.length || 0), 0) || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/teacher/courses"
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-foreground transition-colors"
        >
          <IconBack size={14} />
          <span>العودة لقائمة المقررات</span>
        </Link>
      </div>

      {/* Header Profile */}
      <div className="p-6 rounded-2xl bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-xs border border-primary/20">
              {course.code || 'COURSE'}
            </span>
            <Badge variant={course.status === 'published' ? 'success' : 'neutral'}>
              {course.status === 'published' ? 'منشور للطلاب' : course.status}
            </Badge>
            {course.is_free && <Badge variant="neutral">مقرر مجاني</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{course.title}</h1>
          {course.description && (
            <p className="text-xs text-secondary max-w-2xl">{course.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/student/courses/${course.id}`} target="_blank">
            <Button variant="secondary" size="sm">
              
 معاينة كطالب <IconExternal size={16} />
 </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setTargetModuleId(course.modules?.[0]?.id || null);
              setIsAddLessonModalOpen(true);
            }}
          >
            + إضافة درس سريع
          </Button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircleIcon size={16} /> : <TrashIcon size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-secondary hover:text-foreground" aria-label="إغلاق">
            
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'outline', label: 'مخطط المحتوى والوحدات', badge: course.modules?.length || 0 },
          { id: 'students', label: 'الطلاب ونسب الإنجاز', badge: progressOverview?.total_students || 0 },
          { id: 'settings', label: 'إعدادات المقرر وبياناته' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
        variant="pill"
      />

      {/* TAB 1: OUTLINE BUILDER */}
      {activeTab === 'outline' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BookOpenIcon size={18} className="text-primary" />
                <span>فهرس الوحدات والمحاضرات:</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                إجمالي {course.modules?.length || 0} وحدات • {totalLessons} درساً
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsAddModuleModalOpen(true)}>
              + إضافة وحدة جديدة
            </Button>
          </div>

          {/* Modules List */}
          {!course.modules || course.modules.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyState
                title="المقرر لا يحتوي على أي وحدات بعد"
                description="ابدأ بإنشاء الوحدة الأولى لتنظيم الدروس والمحاضرات للطلاب."
                action={{
                  label: 'إنشاء أول وحدة',
                  onClick: () => setIsAddModuleModalOpen(true),
                }}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {course.modules.map((mod, modIdx) => (
                <Card key={mod.id} className="p-5 rounded-xl space-y-4 border border-border">
                  {/* Module Header */}
                  <div className="flex items-center justify-between border-b border-border/80 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-sm bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                        {modIdx + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{mod.title}</h3>
                        {mod.description && (
                          <p className="text-xs text-secondary mt-0.5">{mod.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setTargetModuleId(mod.id);
                          setIsAddLessonModalOpen(true);
                        }}
                      >
                        + إضافة درس للوحدة
                      </Button>
                      <button
                        onClick={() => handleDeleteModule(mod.id)}
                        className="p-1.5 text-secondary hover:text-danger rounded-sm transition-colors"
                        title="حذف الوحدة"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Lessons List in Module */}
                  {!mod.lessons || mod.lessons.length === 0 ? (
                    <div className="py-6 text-center text-xs text-secondary border border-dashed border-border/60 rounded-md">
                      لا توجد دروس في هذه الوحدة. اضغط على «+ إضافة درس للوحدة» لإضافة محاضرة.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {mod.lessons.map((lesson, lesIdx) => (
                        <div
                          key={lesson.id}
                          className="p-3.5 rounded-md bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-secondary font-mono text-xs">
                              {modIdx + 1}.{lesIdx + 1}
                            </span>
                            <div className="p-1.5 rounded-sm bg-card border border-border text-primary">
                              {lesson.type === 'video' ? (
                                <VideoIcon size={14} />
                              ) : (
                                <FileTextIcon size={14} />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-2">
                                <span>{lesson.title}</span>
                                {lesson.is_free_preview && (
                                  <span className="text-xs px-1.5 py-0.2 rounded-xs bg-primary/10 text-primary border border-primary/20">
                                    معاينة مجانية
                                  </span>
                                )}
                                <span className={`text-xs px-1.5 py-0.2 rounded-xs ${lesson.status === 'published' ? 'bg-primary/10 text-primary' : 'bg-card text-secondary'}`}>
                                  {lesson.status === 'published' ? 'منشور' : 'مسودة'}
                                </span>
                              </div>
                              <div className="text-secondary text-xs mt-0.5 flex items-center gap-3">
                                <span>النوع: {lesson.type || 'فيديو'}</span>
                                {lesson.duration_seconds && (
                                  <span>• المدة: {Math.round(lesson.duration_seconds / 60)} دقيقة</span>
                                )}
                                {lesson.materials && lesson.materials.length > 0 && (
                                  <span className="text-primary">
                                    • {formatNumber(lesson.materials.length)} مرفقات
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setTargetLessonId(lesson.id);
                                setIsAddMaterialModalOpen(true);
                              }}
                              title="إرفاق ملفات أو روابط"
                            >
                              + مرفق
                            </Button>

                            <button
                              onClick={() => handleTogglePublishLesson(lesson)}
                              className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                                lesson.status === 'published'
                                  ? 'border-border text-secondary hover:text-foreground'
                                  : 'border-success/30 text-success bg-success/10'
                              }`}
                            >
                              {lesson.status === 'published' ? 'إلغاء النشر' : 'نشر'}
                            </button>

                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="p-1.5 text-secondary hover:text-danger rounded-sm transition-colors"
                              title="حذف الدرس"
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STUDENTS PROGRESS */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="إجمالي الطلاب المسجلين"
              value={progressOverview?.total_students || 0}
              icon={<UsersIcon size={20} />}
              variant="default"
            />
            <StatCard
              title="إجمالي الدروس"
              value={totalLessons}
              icon={<BookOpenIcon size={20} />}
              variant="indigo"
            />
            <StatCard
              title="متوسط الإنجاز العام"
              value={
                progressOverview?.students && progressOverview.students.length > 0
                  ? `${Math.round(
                      progressOverview.students.reduce((acc, s) => acc + s.completion_percent, 0) /
                        progressOverview.students.length
                    )}%`
                  : '0%'
              }
              icon={<CheckCircleIcon size={20} />}
              variant="emerald"
            />
          </div>

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border font-bold text-foreground text-xs">
              سجل متابعة إنجاز الطلاب للمقرر:
            </div>
            {!progressOverview?.students || progressOverview.students.length === 0 ? (
              <div className="p-12 text-center text-xs text-secondary">
                لا يوجد طلاب مسجلون في هذا المقرر حتى الآن.
              </div>
            ) : (
              <div tabIndex={0} className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-card/60 border-b border-border text-secondary">
                    <tr>
                      <th className="py-3 px-4 font-semibold">الطالب / الكود</th>
                      <th className="py-3 px-4 font-semibold">الدروس المكتملة</th>
                      <th className="py-3 px-4 font-semibold">نسبة الإكمال</th>
                      <th className="py-3 px-4 font-semibold">آخر نشاط</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {progressOverview.students.map((student) => (
                      <tr key={student.student_id} className="hover:bg-card/40">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-foreground">{student.name || 'طالب مسجل'}</div>
                          <div className="text-xs text-secondary font-mono mt-0.5">
                            {student.student_code}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {student.lessons_completed} من {student.total_lessons}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-background overflow-hidden border border-border">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${student.completion_percent}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-foreground">
                              {formatPercent(student.completion_percent)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-secondary">
                          {student.last_active
                            ? formatDateTime(student.last_active)
                            : 'لم يبدأ بعد'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: SETTINGS */}
      {activeTab === 'settings' && (
        <Card className="p-6 rounded-xl max-w-2xl mx-auto space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <h2 className="text-sm font-bold text-fg border-b border-border pb-3 flex items-center gap-2">
              <SettingsIcon size={16} className="text-primary" />
              <span>تعديل بيانات وإعدادات المقرر</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-fg font-medium mb-1 block">اسم المقرر *</label>
                <Input
                  required
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-fg font-medium mb-1 block">كود المقرر</label>
                <Input
                  value={settingsForm.code}
                  onChange={(e) => setSettingsForm({ ...settingsForm, code: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-fg font-medium mb-1 block">الوصف الأكاديمي</label>
              <textarea aria-label="الوصف الأكاديمي"
                rows={3}
                className="w-full rounded-md border border-border bg-background p-3 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                value={settingsForm.description}
                onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-fg font-medium mb-1 block">المستوى التعليمي</label>
                <Select
                  options={[
                    { value: 'beginner', label: 'مبتدئ' },
                    { value: 'intermediate', label: 'متوسط' },
                    { value: 'advanced', label: 'متقدم' },
                  ]}
                  value={settingsForm.level}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, level: e.target.value as typeof settingsForm.level })
                  }
                />
              </div>
              <div>
                <label className="text-fg font-medium mb-1 block">حالة النشر</label>
                <Select
                  options={[
                    { value: 'draft', label: 'مسودة (Draft)' },
                    { value: 'published', label: 'منشور للطلاب' },
                    { value: 'archived', label: 'مؤرشف' },
                  ]}
                  value={settingsForm.status}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, status: e.target.value as typeof settingsForm.status })
                  }
                />
              </div>
              <div>
                <label className="text-fg font-medium mb-1 block">نوع الوصول</label>
                <Select
                  options={[
                    { value: 'false', label: 'مدفوع (يتطلب باقة)' },
                    { value: 'true', label: 'مجاني للجميع' },
                  ]}
                  value={String(settingsForm.is_free)}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, is_free: e.target.value === 'true' })
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4">
              <ImageUploader
                label="صورة المقرر"
                hint="تظهر في قائمة المقررات وصفحة المقرر العامة. يُفضّل نسبة 16:9."
                hasImage={Boolean(course.has_cover)}
                version={coverVersion}
                loadCurrent={() => educationApi.courseCoverBlob(id)}
                onUpload={async (file) => {
                  await educationApi.uploadCourseCover(id, file);
                  setCoverVersion((v) => v + 1);
                  await loadCourseData(true);
                }}
                onRemove={async () => {
                  await educationApi.deleteCourseCover(id);
                  await loadCourseData(true);
                }}
              />
              <Switch
                checked={settingsForm.is_public}
                onChange={(checked) => setSettingsForm({ ...settingsForm, is_public: checked })}
                label="عرض المقرر في الصفحة العامة للأكاديمية"
                description="يظهر للزوار فقط عندما تكون حالة المقرر «منشور للطلاب»."
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <Button
                variant="danger"
                type="button"
                onClick={handleDeleteCourse}
              >
                حذف المقرر
              </Button>

              <Button
                variant="primary"
                type="submit"
                disabled={isSavingSettings}
                isLoading={isSavingSettings}
              >
                حفظ التعديلات
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Modal: Add Module */}
      <Modal
        isOpen={isAddModuleModalOpen}
        onClose={() => setIsAddModuleModalOpen(false)}
        title="إضافة وحدة تعليمية جديدة"
        subtitle="الوحدات تساعد في تقسيم محتوى المنهج إلى فصول دراسية منظمة."
        size="md"
      >
        <form onSubmit={handleCreateModule} className="space-y-4 py-2 text-xs">
          <div>
            <label className="text-fg font-medium mb-1 block">عنوان الوحدة *</label>
            <Input
              required
              placeholder="مثال: الوحدة الأولى: الحركة الدائرية"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-fg font-medium mb-1 block">وصف الوحدة</label>
            <Input
              placeholder="وصف مختصر لموضوعات الوحدة"
              value={moduleDesc}
              onChange={(e) => setModuleDesc(e.target.value)}
            />
          </div>
          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setIsAddModuleModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting} isLoading={isSubmitting}>
              إنشاء الوحدة
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Lesson */}
      <Modal
        isOpen={isAddLessonModalOpen}
        onClose={() => setIsAddLessonModalOpen(false)}
        title="إضافة درس جديد"
        subtitle="حدد نوع المحتوى والمواصفات لإدراجه في الوحدة التعليمية."
        size="lg"
      >
        <form onSubmit={handleCreateLesson} className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-fg font-medium mb-1 block">عنوان الدرس *</label>
              <Input
                required
                placeholder="مثال: قوانين الحركة لنيوتن وتطبيقاتها"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-fg font-medium mb-1 block">الوحدة التابعة</label>
              <Select
                options={[
                  { value: '', label: 'بدون وحدة محددة (مستقل)' },
                  ...(course.modules?.map((m) => ({ value: m.id, label: m.title })) || []),
                ]}
                value={targetModuleId || ''}
                onChange={(e) => setTargetModuleId(e.target.value || null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-fg font-medium mb-1 block">نوع الدرس</label>
              <Select
                options={[
                  { value: 'video', label: 'فيديو ومحاضرة مسجلة' },
                  { value: 'document', label: 'مستند وقراءة PDF' },
                  { value: 'text', label: 'نص وملاحظات تدريبية' },
                ]}
                value={lessonType}
                onChange={(e) => setLessonType(e.target.value as typeof lessonType)}
              />
            </div>
            <div>
              <label className="text-fg font-medium mb-1 block">المدة التقريبية (دقيقة)</label>
              <Input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-fg font-medium mb-1 block">إتاحة المعاينة المجانية</label>
              <Select
                options={[
                  { value: 'false', label: 'مقفول (يتطلب اشتراك)' },
                  { value: 'true', label: 'متاح كمعاينة مجانية للجميع' },
                ]}
                value={String(isFreePreview)}
                onChange={(e) => setIsFreePreview(e.target.value === 'true')}
              />
            </div>
          </div>

          <div>
            <label className="text-fg font-medium mb-1 block">ملاحظات الدرس أو النص التعليمي</label>
            <textarea aria-label="ملاحظات الدرس أو النص التعليمي"
              rows={3}
              placeholder="اكتب نبذة عن الدرس أو المحتوى النصي الكامل للطلاب..."
              className="w-full rounded-md border border-border bg-background p-3 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary"
              value={lessonContent}
              onChange={(e) => setLessonContent(e.target.value)}
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setIsAddLessonModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting} isLoading={isSubmitting}>
              إضافة الدرس
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Material */}
      <Modal
        isOpen={isAddMaterialModalOpen}
        onClose={() => setIsAddMaterialModalOpen(false)}
        title="إرفاق مادة تعليمية للدرس"
        subtitle="يمكنك رفع ملف PDF/ملخص أو إرفاق رابط خارجي يستفيد منه الطلاب."
        size="md"
      >
        <form onSubmit={handleAddMaterial} className="space-y-4 py-2 text-xs">
          <div>
            <label className="text-fg font-medium mb-1 block">اسم المرفق *</label>
            <Input
              required
              placeholder="مثال: ملخص الدرس وقوانين الحركة PDF"
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-fg font-medium mb-1 block">نوع المرفق</label>
            <Select
              options={[
                { value: 'file', label: 'ملف محلي (PDF / Word / صور حتى 20MB)' },
                { value: 'link', label: 'رابط خارجي (Drive / Website)' },
              ]}
              value={materialKind}
              onChange={(e) => setMaterialKind(e.target.value as typeof materialKind)}
            />
          </div>

          {materialKind === 'file' ? (
            <div>
              <label className="text-fg font-medium mb-1 block">اختر الملف</label>
              <input aria-label="اختر الملف"
                type="file"
                required
                onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
                className="w-full rounded-md border border-border bg-background p-2 text-xs text-secondary"
              />
            </div>
          ) : (
            <div>
              <label className="text-fg font-medium mb-1 block">الرابط الخارجي (URL) *</label>
              <Input
                required
                type="url"
                placeholder="https://..."
                value={materialUrl}
                onChange={(e) => setMaterialUrl(e.target.value)}
              />
            </div>
          )}

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setIsAddMaterialModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting} isLoading={isSubmitting}>
              إرفاق المادة
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { educationApi, VideoPlaybackEvent } from '../../../../../../lib/education-api';
import { integrationApi } from '../../../../../../lib/integration-api';
import type { Course, Lesson, MediaAsset, LessonProgressData } from '../../../../../../types';
import { useAuth } from '../../../../../../context/auth-context';
import {
  BookOpenIcon,
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  PlayIcon,
  VideoIcon,
  FileTextIcon,
  DownloadIcon,
  IconBack,
} from '../../../../../../components/icons'

import { formatNumber, formatPercent } from '../../../../../../lib/format';
export default function StudentLessonPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const lessonId = params?.lessonId as string;

  const { user } = useAuth();

  // State
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [mediaAsset, setMediaAsset] = useState<MediaAsset | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<LessonProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Layout state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'video' | 'materials'>('video');

  // Anti-abuse watermark position
  const [watermarkPos, setWatermarkPos] = useState({ top: '15%', left: '20%' });

  // Video player ref & tracking state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingEventsRef = useRef<VideoPlaybackEvent[]>([]);

  // Dynamic watermark movement
  useEffect(() => {
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 75 + 10) + '%';
      const left = Math.floor(Math.random() * 70 + 10) + '%';
      setWatermarkPos({ top, left });
    }, 9000);

    return () => clearInterval(interval);
  }, []);

  // Flush video events to backend
  const flushEvents = useCallback(async () => {
    if (!lessonId || pendingEventsRef.current.length === 0) return;
    const batch = [...pendingEventsRef.current];
    pendingEventsRef.current = [];

    try {
      const result = await educationApi.sendLessonEvents(lessonId, batch);
      if (result?.progress) {
        setProgress(result.progress);
        if (result.progress.completed_at) {
          setIsCompleted(true);
        }
      }
    } catch {
      // Non-blocking sync error
    }
  }, [lessonId]);

  // Periodic flush every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        const currentPos = Math.floor(videoRef.current.currentTime);
        pendingEventsRef.current.push({
          type: 'heartbeat',
          position_seconds: currentPos,
          client_ts: Date.now(),
        });
      }
      flushEvents();
    }, 15000);

    return () => {
      clearInterval(timer);
      flushEvents();
    };
  }, [flushEvents]);

  // Load Course Outline & Current Lesson
  useEffect(() => {
    if (!courseId || !lessonId) return;

    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch course outline
        const outline = await educationApi.getCourseOutline(courseId);
        if (!mounted) return;
        setCourse(outline);

        // Find current lesson in outline
        let foundLesson: Lesson | null = null;
        if (outline.modules) {
          for (const m of outline.modules) {
            const found = m.lessons?.find((l) => l.id === lessonId);
            if (found) {
              foundLesson = found;
              break;
            }
          }
        }

        if (!foundLesson) {
          // Fallback direct lesson fetch
          foundLesson = await educationApi.getLesson(courseId, lessonId);
        }

        if (!mounted) return;
        setLesson(foundLesson);

        // Check if access allowed
        const isAllowed = foundLesson.access?.allowed ?? (foundLesson.is_free_preview || outline.is_free);
        if (!isAllowed) {
          setError('هذا المحتوى يتطلب باقة اشتراك سارية. يرجى الاشتراك للوصول إلى الدرس.');
          setLoading(false);
          return;
        }

        // Set progress
        if (foundLesson.progress) {
          setProgress(foundLesson.progress);
          setIsCompleted(Boolean(foundLesson.progress.completed_at));
        }

        // Check for media asset
        let media = foundLesson.mediaAssets?.[0] || null;
        if (!media) {
          const assets = await integrationApi.getMedia({ lesson_id: lessonId });
          if (assets && assets.length > 0) {
            media = assets[0];
          }
        }
        setMediaAsset(media);

        // Fetch secure embed if media exists
        if (media?.id) {
          try {
            const embed = await integrationApi.getMediaEmbed(media.id);
            if (mounted) setEmbedUrl(embed);
          } catch {
            // Embed fetch fallback
          }
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const e = err as { response?: { data?: { message?: string; error_code?: string } } };
        setError(e.response?.data?.message || 'تعذر تحميل بيانات المحاضرة.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [courseId, lessonId]);

  // Restore playback position once video is loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current && progress?.last_position_seconds) {
      if (progress.last_position_seconds > 5 && !isCompleted) {
        videoRef.current.currentTime = progress.last_position_seconds;
      }
    }
  };

  // Video event handlers
  const handlePlay = () => {
    if (!videoRef.current) return;
    const pos = Math.floor(videoRef.current.currentTime);
    pendingEventsRef.current.push({
      type: 'start',
      position_seconds: pos,
      client_ts: Date.now(),
    });
  };

  const handlePause = () => {
    if (!videoRef.current) return;
    const pos = Math.floor(videoRef.current.currentTime);
    pendingEventsRef.current.push({
      type: 'pause',
      position_seconds: pos,
      client_ts: Date.now(),
    });
    flushEvents();
  };

  const handleSeeked = () => {
    if (!videoRef.current) return;
    const pos = Math.floor(videoRef.current.currentTime);
    pendingEventsRef.current.push({
      type: 'seek',
      position_seconds: pos,
      client_ts: Date.now(),
    });
  };

  const handleEnded = async () => {
    if (!videoRef.current) return;
    const pos = Math.floor(videoRef.current.currentTime);
    pendingEventsRef.current.push({
      type: 'end',
      position_seconds: pos,
      client_ts: Date.now(),
    });
    await flushEvents();
    setIsCompleted(true);
  };

  // Manual completion for document / text lessons
  const handleCompleteManual = async () => {
    if (!lessonId) return;
    try {
      setCompleting(true);
      const res = await educationApi.completeLesson(lessonId);
      setProgress(res.progress);
      setIsCompleted(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر تسجيل اكتمال الدرس.');
    } finally {
      setCompleting(false);
    }
  };

  // Flattened lessons list for prev/next navigation
  const flatLessons = useMemo(() => {
    if (!course?.modules) return [];
    const list: Lesson[] = [];
    course.modules.forEach((mod) => {
      if (mod.lessons) {
        list.push(...mod.lessons);
      }
    });
    return list;
  }, [course]);

  const currentIndex = flatLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

  const watermarkText = useMemo(() => {
    const studentCode = user?.student?.student_code;
    const name = user?.name || 'طالب';
    const contact = user?.phone || user?.email || '';
    return `${name} • ${studentCode ? `[${studentCode}]` : ''} • ${contact}`;
  }, [user]);

  if (loading) {
    return (
      <div className="py-28 text-center text-fg-muted text-sm">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
        <p>جارٍ تجهيز مشغل المحتوى والمحاضرة...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="p-8 rounded-lg bg-surface border border-border text-center max-w-lg mx-auto mt-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-warning-subtle text-warning flex items-center justify-center mx-auto font-bold text-lg">
          <LockIcon size={20} />
        </div>
        <h3 className="text-base font-bold text-fg">محتوى غير متاح</h3>
        <p className="text-xs text-fg-muted leading-relaxed">
          {error || 'عذراً، لا تمتلك صلاحية الوصول لهذه المحاضرة.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href={`/student/courses/${courseId}`}
            className="px-4 py-2 rounded-md border border-border text-xs text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors"
          >
            نظرة عامة على المقرر
          </Link>
          <Link
            href="/student/plans"
            className="px-5 py-2 rounded-md bg-primary text-primary-fg font-semibold text-xs hover:bg-primary-hover transition-colors shadow-xs"
          >
            عرض باقات الاشتراك
          </Link>
        </div>
      </div>
    );
  }

  // Determine video source
  const directVideoUrl = lesson.video_url;
  const effectiveEmbed = embedUrl || mediaAsset?.embed_url;

  return (
    <div className="space-y-4 text-start">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border px-5 py-3.5 rounded-lg shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/student/courses/${courseId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-primary transition-colors shrink-0"
          >
            <IconBack size={14} />
            {course?.title || 'المقرر'}
          </Link>
          <span className="text-border">/</span>
          <h1 className="text-sm font-bold text-fg truncate">{lesson.title}</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success bg-success-subtle px-3 py-1.5 rounded-full border border-success/20">
              <CheckCircleIcon size={14} />
              تم إكمال الدرس
            </span>
          ) : (
            <span className="text-xs font-medium text-fg-muted bg-surface-raised px-3 py-1.5 rounded-full border border-border">
              قيد المتابعة ({formatPercent(progress?.percent || 0)})
            </span>
          )}

          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium text-fg-muted hover:text-fg hover:bg-surface-raised transition-colors"
          >
            {sidebarOpen ? 'إخفاء المنهج' : 'عرض المنهج'}
          </button>
        </div>
      </div>

      {/* Main Grid: Player on right, Outline on left in RTL */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Content Area */}
        <div className={`${sidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'} space-y-4 transition-all`}>
          {/* Player / Content Container */}
          <div className="rounded-lg bg-surface border border-border overflow-hidden shadow-xs relative">
            {lesson.type === 'video' ? (
              <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group select-none">
                {directVideoUrl ? (
                  <video
                    ref={videoRef}
                    src={directVideoUrl}
                    controls
                    controlsList="nodownload"
                    className="w-full h-full object-contain"
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeked={handleSeeked}
                    onEnded={handleEnded}
                  />
                ) : effectiveEmbed ? (
                  <iframe
                    src={effectiveEmbed}
                    title={lesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="text-center p-8 text-fg-muted text-xs space-y-2">
                    <VideoIcon size={36} className="mx-auto text-fg-muted/40" />
                    <p>لم يتم إرفاق ملف فيديو صالح لهذا الدرس حتى الآن.</p>
                  </div>
                )}

                {/* Anti-Abuse Floating Dynamic Watermark */}
                <div
                  className="absolute pointer-events-none text-xs font-mono font-bold text-white/35 bg-black/40 px-3 py-1 rounded-xs backdrop-blur-[2px] transition-all duration-1000 z-20"
                  style={{ top: watermarkPos.top, left: watermarkPos.left }}
                >
                  {watermarkText}
                </div>
              </div>
            ) : (
              /* Document / Text Lesson View */
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider block">
                      {lesson.type === 'document' ? 'ملف تعليمي ومستند' : 'محتوى نصي ومطالعة'}
                    </span>
                    <h2 className="text-xl font-bold text-fg mt-1">{lesson.title}</h2>
                  </div>
                  {!isCompleted && (
                    <button
                      onClick={handleCompleteManual}
                      disabled={completing}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-fg font-semibold text-xs hover:bg-primary-hover shadow-xs disabled:opacity-50 transition-colors"
                    >
                      <CheckCircleIcon size={14} />
                      {completing ? 'جارٍ الحفظ...' : 'تحديد كمكتمل'}
                    </button>
                  )}
                </div>

                {lesson.content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-fg leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
                    {lesson.content}
                  </div>
                ) : (
                  <p className="text-xs text-fg-muted">لا يوجد محتوى نصي مضاف لهذا الدرس.</p>
                )}
              </div>
            )}

            {/* Lesson Tabs: Overview & Materials */}
            <div className="p-4 sm:p-5 border-t border-border bg-surface-raised/40">
              <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
                <button
                  onClick={() => setActiveTab('video')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'video'
                      ? 'bg-primary text-primary-fg shadow-xs'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                  }`}
                >
                  تفاصيل الدرس
                </button>
                <button
                  onClick={() => setActiveTab('materials')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'materials'
                      ? 'bg-primary text-primary-fg shadow-xs'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                  }`}
                >
                  <DownloadIcon size={13} />
                  الملحقات والمذكرات ({lesson.materials?.length || 0})
                </button>
              </div>

              {activeTab === 'video' ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-fg">{lesson.title}</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">
                    {lesson.description || 'تابع مشاهدة الشرح واستفد من الملحقات المرفقة لتحقيق أقصى استفادة.'}
                  </p>
                  {lesson.duration_seconds && (
                    <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                      <ClockIcon size={14} />
                      <span>مدة الدرس: {Math.round(lesson.duration_seconds / 60)} دقيقة</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Materials Download List */
                <div className="space-y-2">
                  {(!lesson.materials || lesson.materials.length === 0) ? (
                    <div className="text-center py-6 text-xs text-fg-muted">
                      لا توجد ملحقات أو ملفات مرفقة لهذا الدرس.
                    </div>
                  ) : (
                    lesson.materials.map((mat) => (
                      <div
                        key={mat.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-md bg-surface border border-border"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileTextIcon size={16} className="text-primary shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-fg block truncate">
                              {mat.title}
                            </span>
                            <span className="text-xs text-fg-muted font-mono">
                              {mat.mime || mat.kind} {mat.size ? `• ${formatNumber(mat.size / 1024 / 1024, 2)} MB` : ''}
                            </span>
                          </div>
                        </div>

                        <a
                          href={mat.url || educationApi.getMaterialDownloadUrl(mat.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-primary-subtle text-primary hover:bg-primary hover:text-primary-fg font-semibold text-xs transition-colors shrink-0"
                        >
                          <DownloadIcon size={13} />
                          تحميل
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Lesson Navigation (Prev / Next) */}
          <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-surface border border-border shadow-xs">
            {prevLesson ? (
              <Link
                href={`/student/courses/${courseId}/lessons/${prevLesson.id}`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-fg-muted hover:text-primary transition-colors"
              >
                <IconBack size={14} />
                الدرس السابق: {prevLesson.title}
              </Link>
            ) : (
              <span className="text-xs text-fg-muted/40">بداية المقرر</span>
            )}

            {nextLesson ? (
              <Link
                href={`/student/courses/${courseId}/lessons/${nextLesson.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-fg font-semibold text-xs hover:bg-primary-hover shadow-xs transition-colors"
              >
                الدرس التالي: {nextLesson.title}
                <PlayIcon size={12} />
              </Link>
            ) : (
              <Link
                href={`/student/courses/${courseId}`}
                className="px-4 py-2 rounded-md bg-success text-success-fg font-semibold text-xs hover:bg-success-hover shadow-xs transition-colors"
              >
                إنهاء المقرر والعودة
              </Link>
            )}
          </div>
        </div>

        {/* Syllabus Outline Sidebar */}
        {sidebarOpen && (
          <div className="lg:col-span-1 space-y-3">
            <div className="rounded-lg bg-surface border border-border p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-bold text-fg flex items-center gap-1.5">
                  <BookOpenIcon size={14} className="text-primary" />
                  منهج المقرر
                </h3>
                <span className="text-xs text-fg-muted font-mono">
                  {currentIndex + 1} / {formatNumber(flatLessons.length)}
                </span>
              </div>

              <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto ps-1">
                {course?.modules?.map((mod, modIdx) => (
                  <div key={mod.id} className="space-y-1.5">
                    <span className="text-xs font-bold text-fg-muted block px-1">
                      {modIdx + 1}. {mod.title}
                    </span>
                    <div className="space-y-1">
                      {mod.lessons?.map((les) => {
                        const isCurrent = les.id === lessonId;
                        const isLesAllowed = les.access?.allowed ?? (les.is_free_preview || course.is_free);
                        const isLesDone = Boolean(les.progress?.completed_at);

                        return (
                          <div
                            key={les.id}
                            onClick={() => {
                              if (isLesAllowed && !isCurrent) {
                                router.push(`/student/courses/${courseId}/lessons/${les.id}`);
                              }
                            }}
                            className={`p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs transition-all ${
                              isCurrent
                                ? 'bg-primary text-primary-fg font-bold shadow-xs'
                                : isLesAllowed
                                ? 'hover:bg-surface-raised text-fg cursor-pointer'
                                : 'text-fg-muted/60 cursor-not-allowed bg-surface-sunken/40'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {les.type === 'video' ? (
                                <VideoIcon size={13} className={isCurrent ? 'text-primary-fg' : 'text-primary'} />
                              ) : (
                                <FileTextIcon size={13} className="shrink-0" />
                              )}
                              <span className="truncate">{les.title}</span>
                            </div>

                            <div className="shrink-0 flex items-center gap-1">
                              {isLesDone ? (
                                <CheckCircleIcon
                                  size={13}
                                  className={isCurrent ? 'text-primary-fg' : 'text-success'}
                                />
                              ) : !isLesAllowed ? (
                                <LockIcon size={11} className="text-warning" />
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

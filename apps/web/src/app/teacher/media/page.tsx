'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { integrationApi } from '../../../lib/integration-api';
import { educationApi } from '../../../lib/education-api';
import type { MediaAsset, Course, Lesson } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { VideoIcon, BookOpenIcon } from '../../../components/icons';

import { Check, Folder, Lightbulb, Link, Play } from 'lucide-react';
import { formatDate, formatNumber } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function TeacherMediaPage() {
  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [media, crs] = await Promise.all([
        integrationApi.getMedia(),
        educationApi.getCourses().catch(partial([])),
      ]);
      setMediaList(media);
      setCourses(crs);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter lessons for selected course
  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === courseId);
  }, [courses, courseId]);

  // Extract clean ID for live preview
  const extractedFileId = useMemo(() => {
    const input = googleDriveUrl.trim();
    if (!input) return '';
    const match1 = input.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) return match1[1];
    const match2 = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) return match2[1];
    return input;
  }, [googleDriveUrl]);

  const previewEmbedUrl = extractedFileId
    ? `https://drive.google.com/file/d/${extractedFileId}/preview`
    : '';

  const handleUploadMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !googleDriveUrl.trim()) return;

    try {
      setIsSubmitting(true);
      setFeedbackMsg(null);

      const created = await integrationApi.uploadMedia({
        title: title.trim(),
        provider: 'google_drive',
        external_id: googleDriveUrl.trim(),
        media_type: 'video',
        course_id: courseId || undefined,
        lesson_id: lessonId || undefined,
      });

      setMediaList((prev) => [created, ...prev]);
      setTitle('');
      setGoogleDriveUrl('');
      setLessonId('');
      setIsAdding(false);
      setFeedbackMsg({
        type: 'success',
        text: `تم ربط فيديو Google Drive بنجاح بالدرس والمقرر! معرف الملف: ${created.external_media_id}`,
      });
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'حدث خطأ أثناء حفظ الفيديو. يرجى التحقق من الرابط والمحاولة مجدداً.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <VideoIcon size={24} className="text-info" />
              مكتبة فيديوهات Google Drive للطلبة
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-info/10 text-info border border-info/20">
              <span className="w-2 h-2 rounded-full bg-info animate-pulse" />
              Google Drive API مفعّل
            </span>
          </div>
          <p className="text-sm text-secondary mt-1">
            ارفع واربط شروحات الدروس ومقاطع الفيديو من Google Drive مباشرة بحسابات ودروس الطلبة بجودة HD.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAdding((v) => !v);
            setFeedbackMsg(null);
          }}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg font-semibold px-4 py-2.5 rounded-md text-xs transition-all shadow-xs"
        >
          <VideoIcon size={16} />
          {isAdding ? 'إغلاق نموذج الإضافة' : '+ ربط فيديو درس من Google Drive'}
        </button>
      </div>

      {/* Integration Info Banner */}
      <div className="rounded-lg bg-surface text-fg p-4 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-info/20 text-info flex items-center justify-center font-bold text-xl shrink-0">
            
 <Folder size={24} strokeWidth={1.75} aria-hidden />
 </div>
          <div>
            <div className="text-xs font-bold flex items-center gap-2">
              <span>Google Drive Video Storage API</span>
              <Badge variant="success">مفعل للطلبة</Badge>
            </div>
            <p className="text-xs text-fg mt-0.5">
              Client ID: <span className="font-mono text-info">978486739253-qb206lpih6c0upanrph3ed1lgvbl4ek4...</span>
            </p>
          </div>
        </div>
        <div className="text-xs text-fg-muted max-w-sm">
          يتم تحويل روابط مشاركة Google Drive تلقائياً لمشغلات آمنة ومتجاوبة مضمنة في صفحات دروس الطلبة.
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-[16px] text-xs font-semibold border ${
            feedbackMsg.type === 'success'
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-danger/10 text-danger border-danger/30'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Add Google Drive Video Form */}
      {isAdding && (
        <Card className="p-6 border-info/30 bg-[color-mix(in_srgb,var(--pri)_5%,transparent)] shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="text-info"><Play size={16} strokeWidth={1.75} aria-hidden /></span>
              إضافة فيديو درس من Google Drive
            </h2>
            <span className="text-xs text-secondary">دعم كامل لروابط Google Drive المباشرة</span>
          </div>

          <form onSubmit={handleUploadMedia} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  عنوان الفيديو / المحاضرة <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شرح الباب الأول - الكيمياء العضوية"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-info transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">المقرر الدراسي المرتبط</label>
                <select aria-label="المقرر الدراسي المرتبط"
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setLessonId('');
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-info transition-all"
                >
                  <option value="">-- اختياري: اختر المقرر المرتبط --</option>
                  {courses.map((crs) => (
                    <option key={crs.id} value={crs.id}>
                      {crs.code} - {crs.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  الدرس المرتبط بالمقرر
                </label>
                <select aria-label="الدرس المرتبط بالمقرر"
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                  disabled={!selectedCourse || !selectedCourse.lessons || selectedCourse.lessons.length === 0}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-info transition-all disabled:opacity-50"
                >
                  <option value="">-- اختياري: اختر درساً محدداً --</option>
                  {selectedCourse?.lessons?.map((les: Lesson) => (
                    <option key={les.id} value={les.id}>
                      {les.sort_order ? `${les.sort_order}. ` : ''}{les.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  رابط مشاركة Google Drive أو معرف الملف (File ID) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://drive.google.com/file/d/1BxiMVs0X.../view"
                  value={googleDriveUrl}
                  onChange={(e) => setGoogleDriveUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-info transition-all font-mono"
                />
              </div>
            </div>

            {/* Google Drive Sharing Tip */}
            <div className="p-3 rounded-md bg-info/10 border border-info/20 text-xs text-info flex items-start gap-2">
              <span className="text-base"><Lightbulb size={18} strokeWidth={1.75} aria-hidden /></span>
              <p className="leading-relaxed">
                <strong>تلميح مهم:</strong> في Google Drive، تأكد من ضبط إعدادات المشاركة للملف على:{' '}
                <span className="underline font-semibold">
                  &quot;أي شخص لديه الرابط يمكنه المشاهدة (Anyone with the link can view)&quot;
                </span>{' '}
                حتى يستطيع الطلبة تشغيل الفيديو داخل المنصة بدون الحاجة لتسجيل دخول إضافي.
              </p>
            </div>

            {/* Live Video Embed Preview */}
            {previewEmbedUrl && (
              <div className="pt-3 border-t border-border">
                <span className="text-xs font-bold text-foreground block mb-2">
                  معاينة مشغل الفيديو المباشر:
                </span>
                <div className="rounded-lg overflow-hidden border border-border bg-black aspect-video max-w-xl mx-auto shadow-md">
                  <iframe
                    src={previewEmbedUrl}
                    className="w-full h-full border-0"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    title="Google Drive Video Preview"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs text-secondary hover:text-foreground transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-md bg-primary hover:bg-primary-hover text-primary-fg font-semibold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'جارٍ الحفظ...' : <><Check size={16} strokeWidth={1.75} aria-hidden /> ربط وحفظ الفيديو للطلبة</>}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Videos List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">
            الفيديوهات والمواد التعليمية المرفوعة ({formatNumber(mediaList.length)})
          </h2>
          <span className="text-xs text-secondary">مرتبة بحسب الأحدث</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-secondary text-sm">جارٍ تحميل الفيديوهات من الخادم...</div>
        ) : mediaList.length === 0 ? (
          <Card className="p-12 text-center text-secondary">
            لا توجد فيديوهات مسجلة بعد. انقر على &quot;+ ربط فيديو درس من Google Drive&quot; لإضافة أول فيديو للطلبة.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {mediaList.map((asset) => {
              const isDrive = asset.provider === 'google_drive';
              return (
                <Card
                  key={asset.id}
                  className="overflow-hidden border border-border hover:border-info/40 transition-all shadow-sm flex flex-col justify-between"
                >
                  {/* Embedded Player or Thumbnail */}
                  <div className="relative aspect-video bg-black/90 flex items-center justify-center border-b border-border">
                    {asset.embed_url ? (
                      <iframe
                        src={asset.embed_url}
                        className="w-full h-full border-0"
                        allow="autoplay; encrypted-media; fullscreen"
                        allowFullScreen
                        title={asset.title}
                      />
                    ) : (
                      <div className="text-center p-4">
                        <VideoIcon size={32} className="text-secondary mx-auto mb-2" />
                        <span className="text-xs text-secondary">مشغل الفيديو</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-info/10 text-info border border-info/20">
                          <span><Folder size={16} strokeWidth={1.75} aria-hidden /></span>
                          <span>{isDrive ? 'Google Drive' : asset.provider}</span>
                        </span>
                        <Badge variant="success">جاهز للمشاهدة</Badge>
                      </div>

                      <h3 className="text-sm font-bold text-foreground leading-snug">{asset.title}</h3>

                      <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-secondary">
                        {asset.course && (
                          <span className="flex items-center gap-1 bg-background px-2 py-0.5 rounded-xs border border-border">
                            <BookOpenIcon size={12} />
                            {asset.course.code}
                          </span>
                        )}
                        {asset.lesson && (
                          <span className="bg-background px-2 py-0.5 rounded-xs border border-border">
                            {asset.lesson.title}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                      {asset.playback_url ? (
                        <a
                          href={asset.playback_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-info hover:underline text-xs flex items-center gap-1 font-medium"
                        >
                          
 <Link size={16} strokeWidth={1.75} aria-hidden /> فتح في Google Drive
 </a>
                      ) : (
                        <span className="text-xs text-secondary font-mono">
                          ID: {asset.external_media_id}
                        </span>
                      )}

                      <span className="text-xs text-secondary font-mono">
                        {asset.created_at ? formatDate(asset.created_at) : 'الآن'}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { integrationApi } from '../../../lib/integration-api';
import { educationApi } from '../../../lib/education-api';
import type { Meeting, Course } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { ClockIcon, VideoIcon, CheckCircleIcon } from '../../../components/icons';

import { Check, Copy, Presentation, Video, X } from 'lucide-react';
import { formatDateTime, formatNumber } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function TeacherMeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [customMeetUrl, setCustomMeetUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [meets, crs] = await Promise.all([
        integrationApi.getMeetings(),
        educationApi.getCourses().catch(partial([])),
      ]);
      setMeetings(meets);
      setCourses(crs);
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setIsSubmitting(true);
      setFeedbackMsg(null);

      const created = await integrationApi.createMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        provider: 'manual',
        course_id: courseId || undefined,
        duration_minutes: Number(durationMinutes),
        start_time: startTime || undefined,
        meet_url: customMeetUrl.trim(),
      });

      setMeetings((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      setStartTime('');
      setCustomMeetUrl('');
      setIsCreating(false);
      setFeedbackMsg({
        type: 'success',
        text: 'تم حفظ الحصة ورابطها.',
      });
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'تعذّر حفظ الحصة. تأكد أن الرابط يبدأ بـ https://',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCancelMeeting = async (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الاجتماع؟')) return;
    try {
      await integrationApi.cancelMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      setFeedbackMsg({ type: 'success', text: 'تم إلغاء الاجتماع بنجاح.' });
    } catch {
      setFeedbackMsg({ type: 'error', text: 'تعذر إلغاء الاجتماع.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <VideoIcon size={24} className="text-primary" />
              الحصص المباشرة
            </h1>
          </div>
          <p className="text-sm text-secondary mt-1">
            أنشئ رابط الاجتماع في Google Meet أو أي خدمة أخرى، ثم الصقه هنا ليظهر لطلابك.
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreating((v) => !v);
            setFeedbackMsg(null);
          }}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg font-semibold px-4 py-2.5 rounded-md text-xs transition-all shadow-xs"
        >
          <VideoIcon size={16} />
          {isCreating ? 'إغلاق نموذج الاجتماع' : '+ إضافة حصة مباشرة'}
        </button>
      </div>

      <div className="rounded-md border border-border bg-surface-muted p-4 text-sm text-fg-muted">
        ربط حساب Google غير متاح بعد، لذلك لا تُنشأ الاجتماعات تلقائياً. الروابط هنا تُحفظ كما تدخلها وتظهر بعلامة «رابط يدوي».
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

      {/* Create Meeting Form */}
      {isCreating && (
        <Card className="p-6 border-primary/30 bg-[color-mix(in_srgb,var(--tq)_5%,transparent)] shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span className="text-primary"><Video size={16} strokeWidth={1.75} aria-hidden /></span>
              بيانات الحصة المباشرة
            </h2>
            <span className="text-xs text-secondary">سيتم توليد رابط الاجتماع فوراً</span>
          </div>

          <form onSubmit={handleCreateMeeting} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  عنوان الجلسة / المحاضرة <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مراجعة نهائية - الفيزياء الحديثة"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">المقرر الدراسي المرتبط</label>
                <select aria-label="المقرر الدراسي المرتبط"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value="">-- اختياري: اختر المقرر المرتبط بالبث --</option>
                  {courses.map((crs) => (
                    <option key={crs.id} value={crs.id}>
                      {crs.code} - {crs.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">موعد البدء (تاريخ ووقت)</label>
                <input aria-label="موعد البدء (تاريخ ووقت)"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">مدة الجلسة بالدقائق</label>
                <select aria-label="مدة الجلسة بالدقائق"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                >
                  <option value={30}>30 دقيقة (نصف ساعة)</option>
                  <option value={45}>45 دقيقة (حصة دراسية)</option>
                  <option value={60}>60 دقيقة (ساعة كاملة)</option>
                  <option value={90}>90 دقيقة (ساعة ونصف)</option>
                  <option value={120}>120 دقيقة (ساعتان)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  رابط الاجتماع *
                </label>
                <input aria-label="رابط الاجتماع"
                  type="text"
                  placeholder="https://meet.google.com/abc-defg-hij"
                  required
                  dir="ltr"
                  value={customMeetUrl}
                  onChange={(e) => setCustomMeetUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">وصف الجلسة وملاحظات للطلبة</label>
              <textarea aria-label="وصف الجلسة وملاحظات للطلبة"
                rows={2}
                placeholder="تعليمات الدخول، الموضوعات المناقشة، الأدوات المطلوبة..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs text-secondary hover:text-foreground transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-md bg-primary hover:bg-primary-hover text-primary-fg font-semibold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'جارٍ الحفظ...' : <><Check size={16} strokeWidth={1.75} aria-hidden /> حفظ الحصة</>}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Meetings List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">الجلسات المجدولة والحالية ({formatNumber(meetings.length)})</h2>
          <span className="text-xs text-secondary">مرتبة بحسب أحدث الجلسات</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-secondary text-sm">جارٍ تحميل الاجتماعات من الخادم...</div>
        ) : meetings.length === 0 ? (
          <Card className="p-12 text-center text-secondary">
            لا توجد حصص مباشرة مجدولة. أضف حصة وألصق رابط الاجتماع.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {meetings.map((meeting) => {
              const isManual = meeting.provider === 'manual';
              return (
                <Card
                  key={meeting.id}
                  className="p-5 border border-border hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                          <span><Video size={16} strokeWidth={1.75} aria-hidden /></span>
                          <span>{isManual ? 'رابط يدوي' : meeting.provider}</span>
                        </span>
                        {meeting.external_meeting_id && (
                          <span className="font-mono text-xs font-semibold text-secondary bg-background px-2 py-0.5 rounded-xs border border-border">
                            {meeting.external_meeting_id}
                          </span>
                        )}
                      </div>
                      <Badge variant={meeting.status === 'completed' ? 'neutral' : 'success'}>
                        {meeting.status === 'completed' ? 'منتهي' : 'متاح وجاهز'}
                      </Badge>
                    </div>

                    <h3 className="mt-3 text-base font-bold text-foreground">{meeting.title}</h3>
                    {meeting.description && (
                      <p className="text-xs text-secondary mt-1 leading-relaxed line-clamp-2">
                        {meeting.description}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between text-xs text-secondary">
                      <span className="flex items-center gap-1">
                        <ClockIcon size={14} className="text-secondary" />
                        المدة: {meeting.duration_minutes} دقيقة
                      </span>
                      {meeting.start_time && (
                        <span>
                          الموعد: {formatDateTime(meeting.start_time)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {/* Host Direct Launch */}
                      <a
                        href={meeting.host_url || meeting.join_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-hover text-primary-fg font-semibold text-xs py-2.5 transition-all shadow-xs"
                      >
                        <span><Presentation size={16} strokeWidth={1.75} aria-hidden /> دخول كمعلم (Host)</span>
                      </a>

                      {/* Copy Link */}
                      <button
                        onClick={() => handleCopyLink(meeting.join_url ?? '', meeting.id)}
                        className="px-3.5 py-2.5 rounded-lg border border-border hover:bg-background text-xs font-medium text-secondary hover:text-foreground transition-colors"
                        title="نسخ رابط الطالب"
                      >
                        {copiedId === meeting.id ? (
                          <span className="text-primary flex items-center gap-1">
                            <CheckCircleIcon size={14} /> تم النسخ
                          </span>
                        ) : (
                          <><Copy size={16} strokeWidth={1.75} aria-hidden /> نسخ الرابط</>
                        )}
                      </button>

                      {/* Cancel */}
                      <button
                        onClick={() => handleCancelMeeting(meeting.id)}
                        className="px-3 py-2.5 rounded-lg border border-danger/20 text-danger hover:bg-danger/10 text-xs transition-colors"
                        title="إلغاء الجلسة"
                       aria-label="إغلاق">
                        
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
                    </div>

                    <span className="text-xs text-secondary truncate font-mono text-center opacity-70">
                      {meeting.join_url}
                    </span>
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

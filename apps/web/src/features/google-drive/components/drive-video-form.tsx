'use client';

import React, { useMemo, useState } from 'react';
import { Link as LinkIcon, Upload } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { ApiError } from '../../../lib/api-client';
import { integrationApi } from '../../../lib/integration-api';
import type { Course, Lesson, MediaAsset } from '../../../types';
import {
  driveUploadApi,
  isSameFile,
  readPendingUpload,
  savePendingUpload,
  uploadToDriveResumable,
  waitForFinalized,
  type PendingUpload,
} from '../api';

type Mode = 'upload' | 'link';

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-fg focus:border-info focus:outline-none focus:shadow-[var(--focus-ring)]';

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'GOOGLE_NOT_CONNECTED') return 'لا يوجد تخزين Google Drive متاح. اطلب من مدير المؤسسة ربط حساب Google من صفحة التكاملات.';
    if (err.code === 'STORAGE_FULL') return 'لا توجد مساحة كافية في حسابات التخزين لهذا الملف. تواصل مع إدارة المنصة.';
    if (err.code === 'INVALID_MEDIA_LINK' || err.code === 'INVALID_UPLOAD') return err.message;
    if (err.code === 'UPLOAD_INCOMPLETE') return 'لم يكتمل رفع الملف إلى Google Drive. أعد المحاولة.';
    if (err.code === 'VALIDATION_FAILED') return 'تحقق من الحقول: يجب أن يكون الملف فيديو.';
  }
  if (err instanceof Error && err.message === 'UPLOAD_FINALIZING') return 'وصل الملف إلى Google Drive وجارٍ تجهيزه. سيظهر في المكتبة بعد قليل.';
  if (err instanceof Error && err.message.startsWith('DRIVE_UPLOAD')) {
    return 'انقطع الرفع إلى Google Drive بعد عدة محاولات. اختر نفس الملف مرة أخرى لاستكمال الرفع من حيث توقف.';
  }
  return 'تعذّر حفظ الفيديو. أعد المحاولة.';
}

/** ADR-008: upload straight to the academy's Drive folder, or register an existing Drive link (kept as "unverified"). */
export function DriveVideoForm({ courses, onCreated, onCancel }: {
  courses: Course[];
  onCreated: (asset: MediaAsset) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>('upload');
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ADR-009: an upload interrupted by a reload or a closed tab, resumed when the same file is picked again.
  const [pending, setPending] = useState<PendingUpload | null>(() => (typeof window === 'undefined' ? null : readPendingUpload()));

  const lessons: Lesson[] = useMemo(() => courses.find((c) => c.id === courseId)?.lessons ?? [], [courses, courseId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || (mode === 'upload' ? !file : !link.trim())) return;
    setSubmitting(true);
    setError(null);
    const target = { course_id: courseId || undefined, lesson_id: lessonId || undefined };

    try {
      if (mode === 'upload' && file) {
        let uploadId: string;
        let uploadUrl: string;
        let offset = 0;

        const resumable = pending && isSameFile(pending, file) ? await driveUploadApi.status(pending.upload_id).catch(() => null) : null;
        if (pending && resumable?.status === 'pending' && resumable.upload_url) {
          uploadId = pending.upload_id;
          uploadUrl = resumable.upload_url;
          offset = resumable.received_bytes ?? 0;
        } else {
          const session = await driveUploadApi.start({
            title: title.trim(), file_name: file.name, mime_type: file.type, size_bytes: file.size, ...target,
          });
          uploadId = session.upload_id;
          uploadUrl = session.upload_url;
          const record = { upload_id: uploadId, file_name: file.name, size: file.size, last_modified: file.lastModified, title: title.trim(), ...target };
          savePendingUpload(record);
          setPending(record);
        }

        setProgress(Math.floor((offset / file.size) * 100));
        await uploadToDriveResumable(uploadId, uploadUrl, file, setProgress, offset);
        const done = await waitForFinalized(uploadId, await driveUploadApi.complete(uploadId));
        if (done.status === 'failed') throw new ApiError('رُفض الملف بعد الرفع: ليس فيديو أو ليس في مجلد المؤسسة.', 'INVALID_UPLOAD', 422);
        savePendingUpload(null);
        setPending(null);
        if (!done.media_asset) throw new Error('UPLOAD_FINALIZING');
        onCreated(done.media_asset);
      } else {
        onCreated(await integrationApi.uploadMedia({
          title: title.trim(), provider: 'google_drive', external_id: link.trim(), media_type: 'video', ...target,
        }));
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex gap-2" role="tablist" aria-label="طريقة الإضافة">
        {([['upload', 'رفع ملف فيديو', Upload], ['link', 'رابط Drive موجود', LinkIcon]] as const).map(([value, label, Icon]) => (
          <Button key={value} type="button" role="tab" aria-selected={mode === value} size="sm"
            variant={mode === value ? 'primary' : 'outline'} icon={<Icon size={16} aria-hidden />}
            onClick={() => { setMode(value); setError(null); }}>
            {label}
          </Button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block text-xs font-semibold text-fg-muted">
            عنوان الفيديو <span className="text-danger">*</span>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className="block text-xs font-semibold text-fg-muted">
            المقرر
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setLessonId(''); }} className={`mt-1 ${inputClass}`}>
              <option value="">— اختياري —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.title}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-fg-muted">
            الدرس
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={lessons.length === 0} className={`mt-1 ${inputClass} disabled:opacity-50`}>
              <option value="">— اختياري —</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
        </div>

        {mode === 'upload' && pending && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-fg">
            <span>رفع غير مكتمل للملف <span dir="ltr" className="font-mono">{pending.file_name}</span>. اختر نفس الملف ليكمل الرفع من حيث توقف.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => { savePendingUpload(null); setPending(null); }}>تجاهل</Button>
          </div>
        )}

        {mode === 'upload' ? (
          <label className="block text-xs font-semibold text-fg-muted">
            ملف الفيديو <span className="text-danger">*</span>
            <input type="file" accept="video/*" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={`mt-1 ${inputClass}`} />
            <span className="mt-1 block font-normal text-fg-subtle">يُرفع مباشرة إلى Google Drive، ويكمل تلقائياً إذا انقطع الاتصال.</span>
          </label>
        ) : (
          <label className="block text-xs font-semibold text-fg-muted">
            رابط مشاركة Google Drive أو معرّف الملف <span className="text-danger">*</span>
            <input type="text" required dir="ltr" value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/file/d/…/view" className={`mt-1 font-mono ${inputClass}`} />
            <span className="mt-1 block font-normal text-fg-subtle">
              إن لم تستطع المنصة رؤية الملف يُحفظ &quot;غير مؤكد&quot;. يجب ضبط مشاركة الملف على &quot;أي شخص لديه الرابط&quot; ليعمل عند الطلبة.
            </span>
          </label>
        )}

        {progress !== null && <ProgressBar value={progress} showLabel />}
        {error && <p role="alert" className="text-xs font-semibold text-danger">{error}</p>}

        <div className="flex justify-end gap-3 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>إلغاء</Button>
          <Button type="submit" isLoading={submitting}>{mode === 'upload' ? 'رفع وحفظ' : 'حفظ الرابط'}</Button>
        </div>
      </form>
    </Card>
  );
}

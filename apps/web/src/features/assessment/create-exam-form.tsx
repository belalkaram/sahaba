'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { assessmentApi } from '../../lib/assessment-api';
import { ApiError } from '../../lib/api-client';
import type { CourseOption } from '../../lib/assessment-overview-api';
import { Card } from '../../components/ui/card';

const FIELD = 'w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary';
const LABEL = 'block text-xs font-semibold text-fg-muted mb-1';

/** Readable message for a failed create request: the server's field error when it gives one. */
export function describeCreateError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status === 403) return 'ليس لديك صلاحية تنفيذ هذا الإجراء.';
  const firstField = Object.values(err.details ?? {})[0];
  if (Array.isArray(firstField) && typeof firstField[0] === 'string') return firstField[0];
  return err.message || fallback;
}

interface CreateExamFormProps {
  courses: CourseOption[];
  defaultCourseId: string;
  onCancel: () => void;
}

/** Creates a draft exam, then opens its builder: questions are added there and publishing requires at least one. */
export function CreateExamForm({ courses, defaultCourseId, onCancel }: CreateExamFormProps) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(defaultCourseId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !title.trim()) return;

    try {
      setSaving(true);
      setError(null);
      const exam = await assessmentApi.createExam(courseId, {
        title: title.trim(),
        description: description.trim() || undefined,
        duration_minutes: duration,
      });
      router.push(`/teacher/courses/${courseId}/exams/${exam.id}/builder`);
    } catch (err) {
      setError(describeCreateError(err, 'تعذّر إنشاء الاختبار. حاول مرة أخرى.'));
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 border-primary/30 bg-surface shadow-xs">
      <h2 className="text-sm font-bold text-fg mb-1">إنشاء اختبار جديد</h2>
      <p className="text-xs text-fg-muted mb-4">يُحفظ الاختبار كمسودة، ثم تنتقل لإضافة الأسئلة ونشره للطلاب.</p>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={LABEL}>المقرر الدراسي</label>
            <select aria-label="مقرر الاختبار" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={`${FIELD} cursor-pointer font-medium`}>
              {courses.map((c) => (
                <option className="bg-surface text-fg py-1.5" key={c.id} value={c.id}>
                  {c.title} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>عنوان الاختبار</label>
            <input aria-label="عنوان الاختبار" type="text" required maxLength={255} placeholder="مثال: اختبار الباب الأول" value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>المدة (دقيقة)</label>
            <input aria-label="مدة الاختبار بالدقائق" type="number" required min="1" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={`${FIELD} font-mono`} />
          </div>
        </div>

        <div>
          <label className={LABEL}>وصف وتعليمات الاختبار</label>
          <textarea aria-label="وصف وتعليمات الاختبار" rows={2} placeholder="اكتب التعليمات التي تظهر للطالب قبل بدء الاختبار..." value={description} onChange={(e) => setDescription(e.target.value)} className={FIELD} />
        </div>

        {error && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md border border-border text-xs text-fg-muted hover:bg-surface-raised">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-md bg-primary hover:bg-primary-hover text-primary-fg font-semibold text-xs transition-colors shadow-xs disabled:opacity-60">
            {saving ? 'جارٍ الإنشاء...' : 'إنشاء ومتابعة لإضافة الأسئلة'}
          </button>
        </div>
      </form>
    </Card>
  );
}

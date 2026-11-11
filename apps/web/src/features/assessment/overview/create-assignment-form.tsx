'use client';

import React, { useState } from 'react';
import { assessmentApi } from '../../../lib/assessment-api';
import type { CourseOption } from '../../../lib/assessment-overview-api';
import { Card } from '../../../components/ui/card';
import { describeCreateError } from '../create-exam-form';

const FIELD = 'w-full bg-surface border border-border rounded-md px-3 py-2 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary';
const LABEL = 'block text-xs font-semibold text-fg-muted mb-1';

interface CreateAssignmentFormProps {
  courses: CourseOption[];
  onCancel: () => void;
  onCreated: () => void;
}

export function CreateAssignmentForm({ courses, onCancel, onCreated }: CreateAssignmentFormProps) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(10);
  const [dueAt, setDueAt] = useState('');
  const [allowLate, setAllowLate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !title.trim()) return;

    try {
      setSaving(true);
      setError(null);
      await assessmentApi.createAssignment(courseId, {
        title: title.trim(),
        description: description.trim() || undefined,
        points_possible: points,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        allow_late: allowLate,
      });
      onCreated();
    } catch (err) {
      setError(describeCreateError(err, 'فشل إنشاء الواجب. يرجى مراجعة البيانات.'));
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 border-primary/30 bg-surface shadow-xs">
      <h2 className="text-sm font-bold text-fg mb-4">إنشاء واجب جديد</h2>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={LABEL}>المقرر الدراسي</label>
            <select aria-label="مقرر الواجب" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={`${FIELD} cursor-pointer font-medium`}>
              {courses.map((c) => (
                <option className="bg-surface text-fg py-1.5" key={c.id} value={c.id}>
                  {c.title} ({c.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>عنوان الواجب</label>
            <input aria-label="عنوان الواجب" type="text" required maxLength={255} placeholder="مثال: تمارين الباب الأول" value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>الدرجة العظمى</label>
            <input aria-label="الدرجة العظمى" type="number" min="0" step="0.5" value={points} onChange={(e) => setPoints(Number(e.target.value))} className={`${FIELD} font-mono`} />
          </div>
          <div>
            <label className={LABEL}>آخر موعد للتسليم (اختياري)</label>
            <input aria-label="آخر موعد للتسليم" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={FIELD} />
          </div>
        </div>

        <div>
          <label className={LABEL}>تعليمات وتفاصيل الواجب</label>
          <textarea aria-label="تعليمات وتفاصيل الواجب" rows={2} placeholder="اكتب التوجيهات والمسائل المطلوبة من الطالب..." value={description} onChange={(e) => setDescription(e.target.value)} className={FIELD} />
        </div>

        <label className="flex items-center gap-2 text-xs font-medium text-fg cursor-pointer w-fit">
          <input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} className="rounded-xs" />
          السماح بالتسليم بعد الموعد
        </label>

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
            {saving ? 'جارٍ النشر...' : 'نشر الواجب للطلبة'}
          </button>
        </div>
      </form>
    </Card>
  );
}

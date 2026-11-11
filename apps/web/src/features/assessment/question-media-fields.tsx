'use client';

import React from 'react';
import { assessmentApi, type AssessmentKind } from '../../lib/assessment-api';

/** Pending image changes made in a question form; applied after the question itself is saved. */
export interface MediaChanges {
  image: File | null;
  removeImage: boolean;
  modelImage: File | null;
  removeModelImage: boolean;
}

export const EMPTY_MEDIA_CHANGES: MediaChanges = { image: null, removeImage: false, modelImage: null, removeModelImage: false };

export function hasMediaChanges(c: MediaChanges): boolean {
  return Boolean(c.image || c.removeImage || c.modelImage || c.removeModelImage);
}

/** Upload / delete the images chosen in the form for a saved question. Throws on the first failure. */
export async function applyMediaChanges(courseId: string, kind: AssessmentKind, itemId: string, questionId: string, c: MediaChanges): Promise<void> {
  if (c.image) await assessmentApi.uploadQuestionImage(courseId, kind, itemId, questionId, c.image, 'question');
  else if (c.removeImage) await assessmentApi.deleteQuestionImage(courseId, kind, itemId, questionId, 'question');

  if (c.modelImage) await assessmentApi.uploadQuestionImage(courseId, kind, itemId, questionId, c.modelImage, 'model_answer');
  else if (c.removeModelImage) await assessmentApi.deleteQuestionImage(courseId, kind, itemId, questionId, 'model_answer');
}

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

function ImagePicker({
  label,
  existing,
  file,
  remove,
  onFile,
  onRemove,
}: {
  label: string;
  existing: boolean;
  file: File | null;
  remove: boolean;
  onFile: (f: File | null) => void;
  onRemove: (r: boolean) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <label className="block font-bold text-secondary">{label}</label>
      <input
        aria-label={label}
        type="file"
        accept={ACCEPT}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > MAX_BYTES) {
            setError('حجم الصورة أكبر من 3 ميجابايت.');
            e.target.value = '';
            return;
          }
          setError(null);
          onFile(f);
          if (f) onRemove(false);
        }}
        className="block w-full text-xs file:me-3 file:rounded-md file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:font-semibold"
      />
      {file && <p className="text-fg-muted">سيُرفع: {file.name}</p>}
      {existing && !file && (
        <label className="flex items-center gap-2 text-fg-muted">
          <input type="checkbox" checked={remove} onChange={(e) => onRemove(e.target.checked)} />
          {remove ? 'ستُحذف الصورة الحالية عند الحفظ' : 'توجد صورة حالية — اختر ملفًا لاستبدالها أو علّم هنا لحذفها'}
        </label>
      )}
      {error && (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      )}
      <p className="text-fg-subtle">JPG أو PNG أو WebP، حتى 3 ميجابايت.</p>
    </div>
  );
}

/** Image of the question + image of its model answer (both optional). */
export function QuestionMediaFields({
  value,
  onChange,
  hasImage,
  hasModelImage,
}: {
  value: MediaChanges;
  onChange: (next: MediaChanges) => void;
  hasImage: boolean;
  hasModelImage: boolean;
}) {
  return (
    <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <ImagePicker
        label="صورة مع السؤال (اختياري)"
        existing={hasImage}
        file={value.image}
        remove={value.removeImage}
        onFile={(image) => onChange({ ...value, image })}
        onRemove={(removeImage) => onChange({ ...value, removeImage })}
      />
      <ImagePicker
        label="صورة الحل النموذجي (اختياري)"
        existing={hasModelImage}
        file={value.modelImage}
        remove={value.removeModelImage}
        onFile={(modelImage) => onChange({ ...value, modelImage })}
        onRemove={(removeModelImage) => onChange({ ...value, removeModelImage })}
      />
    </div>
  );
}

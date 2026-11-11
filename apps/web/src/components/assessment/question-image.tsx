'use client';

import React, { useEffect, useState } from 'react';
import { assessmentApi, type AssessmentKind } from '../../lib/assessment-api';

/**
 * Image attached to a question (or to its model answer). The file sits behind an authorised endpoint, so it
 * is fetched with the bearer token and shown from an object URL (an <img src> cannot send the token).
 */
export function QuestionImage({
  courseId,
  kind,
  itemId,
  questionId,
  variant = 'question',
  alt = 'صورة مرفقة بالسؤال',
}: {
  courseId: string;
  kind: AssessmentKind;
  itemId: string;
  questionId: string;
  variant?: 'question' | 'model_answer';
  alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    assessmentApi
      .questionImageBlob(courseId, kind, itemId, questionId, variant)
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !revoked && setFailed(true));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [courseId, kind, itemId, questionId, variant]);

  if (failed) {
    return <p className="rounded-md border border-border bg-surface-muted p-3 text-sm text-fg-muted">تعذّر تحميل الصورة.</p>;
  }
  if (!url) {
    return <div className="h-40 animate-pulse rounded-lg bg-surface-muted" aria-busy="true" aria-label="جارٍ تحميل الصورة" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob: URL of an authorised private image
    <img src={url} alt={alt} draggable={false} className="max-h-96 max-w-full select-none rounded-lg border border-border bg-surface object-contain" />
  );
}

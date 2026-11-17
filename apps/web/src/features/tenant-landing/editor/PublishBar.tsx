'use client';

/**
 * TL-5 (ADR-007): Fixed publish bar at the bottom of the editor.
 * Shows draft age, preview button, discard, and publish with confirmation.
 */
import React, { useState } from 'react';
import { Eye, Trash2, Rocket, Loader2 } from 'lucide-react';
import { buttonClasses } from '../../../components/ui/button-styles';
import { cn } from '../../../lib/cn';

interface Props {
  hasDraft: boolean;
  draftUpdatedAt: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onPreview: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  publishing: boolean;
  discarding: boolean;
}

function age(isoOrNull: string | null): string {
  if (!isoOrNull) return '';
  const diff = Date.now() - new Date(isoOrNull).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

export function PublishBar({
  hasDraft,
  draftUpdatedAt,
  saveStatus,
  onPreview,
  onDiscard,
  onPublish,
  publishing,
  discarding,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!hasDraft) {
    return (
      <div className="sticky bottom-0 z-30 border-t border-border bg-surface px-4 py-2 text-center text-sm text-fg-muted sm:px-6">
        لا توجد مسودة — الصفحة المنشورة هي الحالية.
      </div>
    );
  }

  const draftLabel =
    saveStatus === 'saving'
      ? 'جارٍ الحفظ…'
      : saveStatus === 'saved'
      ? 'حُفظت المسودة'
      : saveStatus === 'error'
      ? 'فشل الحفظ'
      : draftUpdatedAt
      ? `مسودة غير منشورة ${age(draftUpdatedAt)}`
      : 'مسودة غير منشورة';

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-surface px-4 py-3 sm:px-6">
      {!confirmOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className={cn(
              'text-sm',
              saveStatus === 'error' ? 'text-danger' : 'text-fg-muted',
            )}
            aria-live="polite"
          >
            {saveStatus === 'saving' && <Loader2 size={14} className="me-1.5 inline animate-spin" aria-hidden />}
            {draftLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPreview}
              className={buttonClasses('secondary', 'sm')}
            >
              <Eye size={15} aria-hidden />
              معاينة
            </button>
            <button
              type="button"
              onClick={onDiscard}
              disabled={discarding}
              className={cn(buttonClasses('secondary', 'sm'), 'text-danger hover:border-danger hover:text-danger')}
            >
              {discarding
                ? <Loader2 size={15} className="animate-spin" aria-hidden />
                : <Trash2 size={15} aria-hidden />}
              تجاهل المسودة
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className={buttonClasses('primary', 'sm')}
            >
              <Rocket size={15} aria-hidden />
              نشر
            </button>
          </div>
        </div>
      ) : (
        /* Publish confirmation */
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-fg">
            نشر المسودة الحالية وتحديث الصفحة العامة؟
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className={buttonClasses('secondary', 'sm')}
              disabled={publishing}
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => { setConfirmOpen(false); onPublish(); }}
              className={buttonClasses('primary', 'sm')}
              disabled={publishing}
            >
              {publishing
                ? <Loader2 size={15} className="animate-spin" aria-hidden />
                : <Rocket size={15} aria-hidden />}
              تأكيد النشر
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

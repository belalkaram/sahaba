'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';

const MAX_MB = 3;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export interface ImageUploaderProps {
  /** Loads the current stored image as a blob (authenticated). Omit/ignore when `hasImage` is false. */
  loadCurrent?: () => Promise<Blob>;
  hasImage: boolean;
  /** Changing this re-loads the preview (e.g. bump after a successful upload). */
  version?: number;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  shape?: 'cover' | 'avatar';
  label: string;
  hint?: string;
  disabled?: boolean;
}

/** Image picker with live preview. Validates type/size on the client; the server re-validates. */
export function ImageUploader({ loadCurrent, hasImage, version = 0, onUpload, onRemove, shape = 'cover', label, hint, disabled }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    if (!hasImage || !loadCurrent) {
      setPreview(null);
      return;
    }
    loadCurrent()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch(() => !cancelled && setPreview(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasImage, version]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('الصيغ المسموحة: JPG أو PNG أو WebP.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`الحجم الأقصى ${MAX_MB} ميجابايت.`);
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } catch {
      setError('تعذّر رفع الصورة. حاول مرة أخرى.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRemove();
    } catch {
      setError('تعذّر حذف الصورة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-fg">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            'relative grid shrink-0 place-items-center overflow-hidden border border-dashed border-border-strong bg-surface-muted text-fg-subtle',
            shape === 'avatar' ? 'h-24 w-24 rounded-full' : 'aspect-[16/9] w-48 rounded-lg',
          )}
        >
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={26} strokeWidth={1.5} aria-hidden />}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-surface-overlay">
              <Loader2 className="animate-spin text-fg" size={22} aria-hidden />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={disabled || busy} aria-label={label} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
              className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-muted disabled:opacity-50"
            >
              {hasImage ? 'تغيير الصورة' : 'رفع صورة'}
            </button>
            {hasImage && (
              <button
                type="button"
                onClick={remove}
                disabled={disabled || busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-subtle disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden /> حذف
              </button>
            )}
          </div>
          <p className="text-xs text-fg-muted">{hint ?? `JPG أو PNG أو WebP — حتى ${MAX_MB} ميجابايت.`}</p>
          {error && (
            <p role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * TL-5 (ADR-007): Preview iframe with responsive size buttons and dark/light toggle.
 * Shows the real /a/{slug} page with the preview token so the draft is visible.
 */
import React, { useState, useRef } from 'react';
import { Monitor, Tablet, Smartphone, Sun, Moon, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/cn';

interface Props {
  slug: string;
  previewToken: string | null;
  onRequestToken: () => Promise<void>;
  loadingToken: boolean;
  /** Bumped after every saved draft so the iframe reloads with the latest changes. */
  refreshKey: number;
  /** Without a draft the published page is exactly what the owner edits — no token needed. */
  hasDraft: boolean;
}

type Width = '390' | '768' | '1280';
type Scheme = 'light' | 'dark';

const SIZE_BUTTONS: Array<{ label: string; value: Width; Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> }> = [
  { label: 'جوال', value: '390', Icon: Smartphone },
  { label: 'لوح', value: '768', Icon: Tablet },
  { label: 'سطح مكتب', value: '1280', Icon: Monitor },
];

export function PreviewFrame({ slug, previewToken, onRequestToken, loadingToken, refreshKey, hasDraft }: Props) {
  const [width, setWidth] = useState<Width>('1280');
  const [scheme, setScheme] = useState<Scheme>('light');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = previewToken
    ? `/a/${slug}?preview=${encodeURIComponent(previewToken)}`
    : `/a/${slug}`;

  // `theme` is honoured only inside a frame (ThemeProvider); `v` forces a reload after each save.
  const iframeParams = new URLSearchParams();
  if (previewToken) iframeParams.set('preview', previewToken);
  iframeParams.set('theme', scheme);
  iframeParams.set('v', String(refreshKey));
  const iframeSrc = `/a/${slug}?${iframeParams.toString()}`;

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2">
        {/* Width buttons */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-0.5">
          {SIZE_BUTTONS.map(({ label, value, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setWidth(value)}
              className={cn(
                'flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors',
                width === value
                  ? 'bg-surface text-fg shadow-xs'
                  : 'text-fg-muted hover:text-fg',
              )}
              aria-label={label}
              aria-pressed={width === value}
            >
              <Icon size={13} aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Dark / light toggle */}
          <button
            type="button"
            onClick={() => setScheme((s) => (s === 'light' ? 'dark' : 'light'))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:text-fg"
            aria-label={scheme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'}
          >
            {scheme === 'light' ? <Moon size={14} aria-hidden /> : <Sun size={14} aria-hidden />}
          </button>

          {/* Open in new tab */}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-fg-muted hover:text-fg"
            aria-label="فتح في نافذة جديدة"
          >
            <ExternalLink size={14} aria-hidden />
          </a>
        </div>
      </div>

      {/* Iframe container */}
      <div className="relative flex min-w-0 flex-1 items-start justify-center overflow-auto bg-surface-sunken p-4">
        {!previewToken && hasDraft && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-surface/90 backdrop-blur-sm">
            <p className="text-sm text-fg-muted">
              انتهت صلاحية المعاينة أو لم تبدأ بعد. أنشئ رمز معاينة لترى تعديلاتك.
            </p>
            <button
              type="button"
              onClick={onRequestToken}
              disabled={loadingToken}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              {loadingToken && <Loader2 size={14} className="animate-spin" aria-hidden />}
              معاينة المسودة (15 دقيقة)
            </button>
          </div>
        )}
        <div
          className="overflow-hidden rounded-md shadow-lg transition-all duration-200"
          style={{ width: `${width}px`, maxWidth: '100%' }}
        >
          <iframe
            ref={iframeRef}
            key={iframeSrc}
            src={iframeSrc}
            title="معاينة الصفحة العامة"
            className="block w-full"
            style={{
              height: '80vh',
              minHeight: 480,
              border: 'none',
              colorScheme: scheme,
            }}
            data-color-scheme={scheme}
          />
        </div>
      </div>
    </div>
  );
}

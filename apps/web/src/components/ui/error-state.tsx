'use client';

import React from 'react';
import { Button } from './button';

import { TriangleAlert } from 'lucide-react';
export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'حدث خطأ غير متوقع',
  description = 'تعذر إكمال العملية المطلوبة. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.',
  error,
  onRetry,
  className = '',
}) => {
  const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : null;

  return (
    <div
      className={`min-h-[300px] flex flex-col items-center justify-center text-center p-6 rounded-lg border border-danger/20 bg-danger-subtle/10 ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-danger-subtle text-danger text-2xl mb-4 font-bold">
        
 <TriangleAlert size={24} strokeWidth={1.75} aria-hidden />
 </div>
      <h3 className="text-base font-bold text-fg mb-1.5">{title}</h3>
      <p className="text-xs text-fg-muted max-w-sm leading-relaxed mb-4">{description}</p>
      {errorMessage && (
        <code className="text-xs font-mono text-danger bg-surface p-2 rounded-xs border border-danger/20 max-w-md mb-4 break-all">
          {errorMessage}
        </code>
      )}
      {onRetry && (
        <Button variant="primary" size="sm" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
};


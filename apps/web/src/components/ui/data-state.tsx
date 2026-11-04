'use client';

/**
 * R1B — DataState Component
 * Renders standard loading / empty / error / forbidden states.
 * Replaces ad-hoc catch(() => []) anti-patterns in all page components.
 *
 * Usage:
 *   <DataState state="loading" />
 *   <DataState state="error" message="تعذر تحميل البيانات" />
 *   <DataState state="empty" message="لا توجد بيانات بعد" />
 *   <DataState state="forbidden" />
 */

import React from 'react';

import { Inbox, Lock, TriangleAlert } from 'lucide-react';
export type DataStateKind = 'loading' | 'empty' | 'error' | 'forbidden';

export interface DataStateProps {
  state: DataStateKind;
  message?: string;
  /** Optional retry handler (shown on error state) */
  onRetry?: () => void;
}

export const DataState: React.FC<DataStateProps> = ({ state, message, onRetry }) => {
  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin opacity-40" />
        <p className="text-sm opacity-50">{message ?? 'جاري التحميل...'}</p>
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <div className="text-4xl opacity-30"><Inbox size={32} strokeWidth={1.75} aria-hidden /></div>
        <p className="text-sm opacity-60">{message ?? 'لا توجد بيانات لعرضها.'}</p>
      </div>
    );
  }

  if (state === 'forbidden') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <div className="text-4xl"><Lock size={32} strokeWidth={1.75} aria-hidden /></div>
        <p className="text-sm font-semibold">غير مصرح بالوصول</p>
        <p className="text-xs opacity-60">
          {message ?? 'ليس لديك الصلاحية لعرض هذه البيانات.'}
        </p>
      </div>
    );
  }

  // error
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="text-4xl"><TriangleAlert size={32} strokeWidth={1.75} aria-hidden /></div>
      <p className="text-sm font-semibold text-danger">
        {message ?? 'حدث خطأ أثناء تحميل البيانات.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-4 py-2 rounded-full border border-current opacity-70 hover:opacity-100 transition-opacity"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
};


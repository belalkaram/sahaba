'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

import { Check, Info, TriangleAlert, X } from 'lucide-react';
export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, description?: string) => void;
  danger: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, description, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, description, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, description?: string) => addToast({ type: 'success', title, description }), [addToast]);
  const danger = useCallback((title: string, description?: string) => addToast({ type: 'danger', title, description }), [addToast]);
  const warning = useCallback((title: string, description?: string) => addToast({ type: 'warning', title, description }), [addToast]);
  const info = useCallback((title: string, description?: string) => addToast({ type: 'info', title, description }), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, danger, warning, info }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[80] flex flex-col gap-2 md:inset-x-auto md:bottom-4 md:end-4 md:w-full md:max-w-sm"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className="glass pointer-events-auto flex items-center gap-3 rounded-lg p-4 text-fg transition-all animate-in slide-in-from-bottom-2 duration-200"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${
                toast.type === 'success'
                  ? 'bg-primary-subtle text-primary'
                  : toast.type === 'danger'
                  ? 'bg-danger-subtle text-danger'
                  : toast.type === 'warning'
                  ? 'bg-warning-subtle text-warning'
                  : 'bg-info-subtle text-info'
              }`}
            >
              {toast.type === 'success' && <Check size={18} strokeWidth={1.75} aria-hidden />}
              {toast.type === 'danger' && <X size={18} strokeWidth={1.75} aria-hidden />}
              {toast.type === 'warning' && <TriangleAlert size={18} strokeWidth={1.75} aria-hidden />}
              {toast.type === 'info' && <Info size={18} strokeWidth={1.75} aria-hidden />}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-[15px] font-bold leading-snug">{toast.title}</h5>
              {toast.description && (
                <p className="text-[13px] text-fg-muted mt-0.5 leading-relaxed">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
              aria-label="إغلاق التنبيه"
            >
              
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}


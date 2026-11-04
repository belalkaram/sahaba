'use client';

import React, { useRef, useEffect } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import type { ClassSession } from '../../../types';

import { formatDate, formatNumber } from '../../../lib/format';
export interface CheckedInStudent {
  name: string;
  code: string;
  time: string;
  mode: string;
}

export interface LiveQrScannerModalProps {
  session: ClassSession | null;
  isOpen: boolean;
  onClose: () => void;
  scannedCode: string;
  onScannedCodeChange: (code: string) => void;
  onScanSubmit: (e: React.FormEvent) => Promise<void>;
  isScanning: boolean;
  liveAttendees: CheckedInStudent[];
  recordSuccess: string | null;
}

export const LiveQrScannerModal: React.FC<LiveQrScannerModalProps> = ({
  session,
  isOpen,
  onClose,
  scannedCode,
  onScannedCodeChange,
  onScanSubmit,
  isScanning,
  liveAttendees,
  recordSuccess,
}) => {
  const scannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, [isOpen]);

  if (!session) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مسح الحضور الإلكتروني السريع (Dynamic QR)"
      subtitle={`الجلسة الحالية: ${formatDate(session.session_date || session.starts_at)}`}
      size="lg"
    >
      <div className="space-y-4 py-2 text-start">
        {recordSuccess && (
          <div className="p-3 rounded-md bg-success-subtle text-success-subtle-fg border border-success/30 text-xs font-semibold">
            {recordSuccess}
          </div>
        )}

        <form onSubmit={onScanSubmit} className="space-y-2">
          <label className="text-xs font-semibold text-fg block">
            امسح باركود الطالب بجهاز القارئ (أو أدخل الكود يدوياً):
          </label>
          <div className="flex gap-2">
            <input
              ref={scannerInputRef}
              type="text"
              value={scannedCode}
              onChange={(e) => onScannedCodeChange(e.target.value)}
              placeholder="ضع المؤشر هنا وامسح البطاقة بالماسح..."
              className="flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-xs text-fg focus:border-primary focus:outline-none"
              disabled={isScanning}
            />
            <Button variant="primary" type="submit" isLoading={isScanning}>
              تسجيل
            </Button>
          </div>
        </form>

        <div className="pt-2 border-t border-border">
          <h4 className="text-xs font-bold text-fg mb-2">
            الطلاب المسجل حضورهم في هذه الجلسة ({formatNumber(liveAttendees.length)}):
          </h4>
          {liveAttendees.length === 0 ? (
            <p className="text-xs text-fg-muted text-center py-4">لم يتم مسح أي طالب بعد.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-border">
              {liveAttendees.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-semibold text-fg">{att.name}</span>
                    <span className="text-xs text-fg-muted font-mono ms-2">{att.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fg-subtle">{att.time}</span>
                    <Badge variant="success">تم الرصد</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};


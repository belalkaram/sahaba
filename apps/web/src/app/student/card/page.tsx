'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { attendanceApi } from '../../../lib/attendance-api';
import type { StudentQrTokenData } from '../../../types';
import {
  QrCodeIcon,
  RefreshCwIcon,
  ShieldIcon,
  SparklesIcon,
  CheckCircleIcon,
} from '../../../components/icons';

import { IconNext } from '../../../components/icons/directional';
export default function StudentCardPage() {
  const [data, setData] = useState<StudentQrTokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [copied, setCopied] = useState(false);
  const [showPrintCard, setShowPrintCard] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const printCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (showPrintCard && data?.student.student_code && printCanvasRef.current) {
      QRCode.toCanvas(printCanvasRef.current, data.student.student_code, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).catch(() => {});
    }
  }, [showPrintCard, data?.student.student_code]);

  const fetchToken = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setError(null);
      const res = await attendanceApi.getStudentQr();
      if (!isMountedRef.current) return;
      setData(res);

      if (res.expires_at) {
        const diff = Math.max(0, Math.floor((new Date(res.expires_at).getTime() - Date.now()) / 1000));
        setSecondsRemaining(diff > 0 ? diff : 60);
      } else {
        setSecondsRemaining(60);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'تعذر تحميل رمز بطاقة الحضور.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchToken();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchToken]);

  useEffect(() => {
    if (data?.token && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data.token, {
        width: 260,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).catch(() => {
        // Render fallback
      });
    }
  }, [data?.token]);

  useEffect(() => {
    if (!data) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 3) {
          fetchToken();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [data, fetchToken]);

  const handleCopyCode = () => {
    if (!data?.student.student_code) return;
    navigator.clipboard.writeText(data.student.student_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / 60) * 100));

  return (
    <div className="max-w-md mx-auto py-4 space-y-5 text-start">
      {/* Page Header */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-fg flex items-center justify-center gap-2">
          <QrCodeIcon size={24} className="text-primary" />
          بطاقة الطالب الذكية
        </h1>
        <p className="text-xs text-fg-muted">
          أبرز هذا الرمز عند دخول القاعة لتسجيل حضورك في الحصص والمجموعات الحضورية.
        </p>
      </div>

      {/* Screen Brightness Hint Banner */}
      <div className="p-3 rounded-sm bg-primary-subtle border border-primary/20 flex items-center gap-2.5 text-xs text-fg">
        <SparklesIcon size={18} className="text-primary shrink-0" />
        <span className="leading-relaxed">
          <strong>تلميح:</strong> يُفضل رفع سطوع شاشة هاتفك لتسهيل قراءة الرمز عبر ماسح الكاميرا في السنتر.
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-sm bg-danger-subtle border border-danger/20 text-danger text-xs font-semibold text-center">
          {error}
          <div className="mt-2">
            <button
              onClick={() => fetchToken(true)}
              className="px-4 py-1.5 rounded-xs bg-danger text-danger-fg text-xs font-bold hover:bg-danger-hover transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      {/* Student ID Card Container */}
      <div className="relative rounded-md bg-surface border-2 border-border shadow-lg overflow-hidden p-6 space-y-5 text-center transition-all">
        {/* Card Header (Tenant Info) */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-start">
            <span className="w-8 h-8 rounded-full bg-primary-subtle text-primary font-bold text-sm flex items-center justify-center">
              {data?.tenant.name?.[0] || 'L'}
            </span>
            <div>
              <span className="text-xs font-bold text-fg block">{data?.tenant.name || 'المركز التعليمي'}</span>
              <span className="text-xs text-fg-muted">نظام الحضور الذكي</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success-subtle px-2.5 py-1 rounded-full border border-success/20">
            <ShieldIcon size={12} />
            رمز موثق
          </span>
        </div>

        {/* Student Profile Info */}
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-fg">{data?.student.name || 'طالب'}</h2>
          <div className="flex items-center justify-center gap-2 pt-0.5">
            <button
              onClick={handleCopyCode}
              title="انقر لنسخ الكود"
              className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-xs bg-primary-subtle border border-primary/20 hover:bg-primary/20 transition-colors flex items-center gap-1.5"
            >
              <span>{data?.student.student_code || '---'}</span>
              {copied ? <CheckCircleIcon size={12} className="text-success" /> : null}
            </button>
            {data?.student.grade_level && (
              <span className="text-xs text-fg-muted font-medium px-2 py-0.5 rounded-full bg-surface-raised border border-border">
                {data.student.grade_level}
              </span>
            )}
          </div>
        </div>

        {/* QR Code Canvas Box */}
        <div className="relative mx-auto w-[270px] h-[270px] rounded-sm bg-surface border-2 border-border p-1 flex items-center justify-center shadow-inner group">
          {loading ? (
            <div className="text-center text-xs text-fg-muted space-y-2">
              <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              <p>جارٍ توليد الرمز الآمن...</p>
            </div>
          ) : (
            <canvas ref={canvasRef} className="rounded-xs" />
          )}

          {refreshing && (
            <div className="absolute inset-0 bg-fg/80 backdrop-blur-[1px] rounded-sm flex items-center justify-center text-xs font-semibold text-primary gap-2">
              <RefreshCwIcon size={16} className="animate-spin" />
              جارٍ التحديث...
            </div>
          )}
        </div>

        {/* Countdown Ring / Progress Bar */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>صلاحية الرمز المؤقت:</span>
            <span className="font-mono font-bold text-fg">{secondsRemaining} ثانية</span>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-sunken border border-border overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                secondsRemaining <= 10 ? 'bg-danger' : 'bg-primary'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-xs text-fg-muted">
            يتجدد الرمز تلقائياً كل 60 ثانية لحماية حسابك ومنع تداول الصور الثابتة.
          </p>
        </div>

        {/* Card Actions */}
        <div className="pt-2 border-t border-border flex flex-col gap-2">
          <button
            onClick={() => fetchToken(true)}
            disabled={refreshing}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xs bg-primary text-primary-fg font-semibold text-xs hover:bg-primary-hover transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCwIcon size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'جارٍ التحديث...' : 'تحديث الرمز الآن'}
          </button>

          <button
            type="button"
            onClick={() => setShowPrintCard(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xs bg-surface-raised border border-border text-fg font-semibold text-xs hover:bg-surface-sunken transition-colors"
          >
            <Printer size={14} />
            <span>معاينة وطباعة بطاقة الطالب الورقية</span>
          </button>
        </div>
      </div>

      {/* Printable Card Modal */}
      {showPrintCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-sunken/50 backdrop-blur-sm">
          <div className="bg-surface rounded-lg max-w-sm w-full p-6 shadow-xl space-y-4 text-center">
            <div className="border-2 border-dashed border-border rounded-md p-5 bg-surface-muted space-y-3">
              <div className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                {data?.tenant.name || 'المركز التعليمي'}
              </div>
              <h3 className="text-base font-bold text-fg">{data?.student.name}</h3>
              <div className="text-xs font-mono font-bold text-primary bg-primary-subtle py-1 px-2.5 rounded-xs inline-block border border-primary/30">
                {data?.student.student_code}
              </div>
              {data?.student.grade_level && (
                <div className="text-xs text-fg-muted">{data.student.grade_level}</div>
              )}
              <div className="flex justify-center p-2 bg-surface rounded-sm border border-border shadow-sm mx-auto w-fit">
                <canvas ref={printCanvasRef} />
              </div>
              <p className="text-xs text-fg-muted">بطاقة دخول وحضور الطالب الرسمية</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintCard(false)}
                className="px-4 py-2 rounded-md text-xs font-bold text-fg-subtle hover:bg-surface-muted"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-primary text-primary-fg rounded-md text-xs font-bold hover:bg-primary flex items-center gap-1.5 shadow-sm"
              >
                <Printer size={14} />
                <span>طباعة الكارت</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link to attendance history */}
      <div className="text-center pt-1">
        <Link
          href="/student/attendance"
          className="text-xs font-semibold text-primary hover:underline"
        >
          
 عرض سجل حضوري وغيابي في المجموعات <IconNext size={16} />
 </Link>
      </div>
    </div>
  );
}

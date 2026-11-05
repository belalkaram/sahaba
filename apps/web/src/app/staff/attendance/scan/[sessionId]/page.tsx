'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { attendanceApi, type SessionReportData } from '../../../../../lib/attendance-api';
import type { AttendanceRecord, AttendanceScanResult, ClassSession, Student } from '../../../../../types';
import { useQrScanner } from '../../../../../features/attendance/use-qr-scanner';
import { Card } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import { Modal } from '../../../../../components/ui/modal';
import { formatNumber, formatPercent, formatTime } from '../../../../../lib/format';
import {
  QrCode,
  Flashlight,
  RefreshCw,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Users,
  LogOut,
  Camera,
  CameraOff,
} from 'lucide-react';

interface RecentScanItem {
  id: string;
  recordId?: string;
  name: string;
  code: string;
  status: 'present' | 'late' | 'already';
  time: string;
  isDuplicate: boolean;
}

export default function StaffAttendanceSessionScannerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  // Session & live report state
  const [session, setSession] = useState<ClassSession | null>(null);
  const [report, setReport] = useState<SessionReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Active tab: 'recent' | 'unrecorded'
  const [activeTab, setActiveTab] = useState<'recent' | 'unrecorded'>('recent');

  // Scanner UI & feedback state
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    type: 'success' | 'already' | 'error';
    title: string;
    message: string;
    studentName?: string;
    studentCode?: string;
    status?: string;
    recordId?: string;
  } | null>(null);

  // Undo state (30-second timer for last scan)
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(0);
  const [undoRecordId, setUndoRecordId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  // Recent scans list
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);

  // End session dialog
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Manual recording state
  const [manualRecordingId, setManualRecordingId] = useState<string | null>(null);

  // Audio feedback via Web Audio API
  const playAudioFeedback = useCallback((type: 'success' | 'already' | 'error') => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'already') {
        osc.frequency.setValueAtTime(587, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // AudioContext fallback
    }
  }, []);

  // Haptic feedback
  const triggerHaptic = useCallback((type: 'success' | 'already' | 'error') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'success') navigator.vibrate(100);
      else if (type === 'already') navigator.vibrate([60, 60, 60]);
      else navigator.vibrate([150, 80, 150]);
    }
  }, []);

  // Countdown timer for undo
  useEffect(() => {
    if (undoSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setUndoSecondsLeft((prev) => {
        if (prev <= 1) {
          setUndoRecordId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [undoSecondsLeft]);

  // Load session details and attendance report
  const loadData = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setSessionError(null);
      const [sessData, repData] = await Promise.all([
        attendanceApi.getSession(sessionId),
        attendanceApi.getSessionReport(sessionId).catch(() => null),
      ]);
      setSession(sessData);
      if (repData) setReport(repData);
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : 'تعذر تحميل بيانات الجلسة.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle scanned raw QR token or barcode
  const handleProcessScan = useCallback(
    async (decodedText: string) => {
      if (isProcessing || !sessionId) return;
      setIsProcessing(true);

      const isDynamicToken = decodedText.includes('.');
      const payload = isDynamicToken ? { token: decodedText } : { qr_data: decodedText };

      try {
        const res: AttendanceScanResult = await attendanceApi.scanAttendance(sessionId, payload);

        const isDuplicate = res.already_recorded;
        const resultType = isDuplicate ? 'already' : 'success';

        playAudioFeedback(resultType);
        triggerHaptic(resultType);

        const studentStatus = (res.student.status as 'present' | 'late') || 'present';

        setLastScanResult({
          type: resultType,
          title: isDuplicate
            ? 'مسجل مسبقاً'
            : studentStatus === 'late'
            ? 'تم تسجيل الحضور (متأخر)'
            : 'تم تسجيل الحضور بنجاح',
          message: res.message,
          studentName: res.student.name,
          studentCode: res.student.student_code,
          status: studentStatus,
          recordId: res.record?.id,
        });

        // Set undo timer for new scans
        if (!isDuplicate && res.record?.id) {
          setUndoRecordId(res.record.id);
          setUndoSecondsLeft(30);
        }

        // Add to recent scans list
        setRecentScans((prev) => [
          {
            id: res.student.id + '-' + Date.now(),
            recordId: res.record?.id,
            name: res.student.name,
            code: res.student.student_code,
            status: isDuplicate ? 'already' : studentStatus,
            time: formatTime(new Date()),
            isDuplicate,
          },
          ...prev.slice(0, 14),
        ]);

        // Refresh report stats
        attendanceApi.getSessionReport(sessionId).then(setReport).catch(() => {});
      } catch (err: unknown) {
        playAudioFeedback('error');
        triggerHaptic('error');

        const e = err as {
          response?: { data?: { error?: { code?: string; message?: string }; message?: string } };
        };
        const errCode = e.response?.data?.error?.code || '';
        let msg = e.response?.data?.error?.message || e.response?.data?.message || '';

        // Standardized Arabic error messages
        if (errCode === 'QR_TOKEN_EXPIRED' || errCode === 'QR_EXPIRED') {
          msg = 'رمز الـ QR منتهي الصلاحية، يرجى تحديث بطاقة الطالب.';
        } else if (errCode === 'STUDENT_NOT_IN_CLASS' || errCode === 'NOT_ENROLLED') {
          msg = 'الطالب غير مسجل في هذه المجموعة أو الفصل.';
        } else if (errCode === 'SESSION_CLOSED') {
          msg = 'الحصة منتهية أو ملغاة ولا يمكن تسجيل الحضور بها.';
        } else if (errCode === 'STUDENT_INACTIVE') {
          msg = 'حساب الطالب غير نشط أو معلق.';
        } else if (!msg) {
          msg = 'فشل التحقق من رمز الـ QR. يرجى المحاولة مجدداً.';
        }

        setLastScanResult({
          type: 'error',
          title: 'فشل تسجيل الحضور',
          message: msg,
        });
      } finally {
        setTimeout(() => {
          setIsProcessing(false);
        }, 800);
      }
    },
    [sessionId, isProcessing, playAudioFeedback, triggerHaptic]
  );

  // Setup universal camera scanner
  const {
    videoRef,
    isScanning,
    hasCamera,
    hasTorch,
    isTorchOn,
    error: scannerError,
    engine,
    startScanner,
    stopScanner,
    toggleTorch,
    flipCamera,
  } = useQrScanner({
    onScan: handleProcessScan,
    enabled: true,
  });

  // Revert last scan (Undo within 30 seconds)
  const handleUndoLastScan = async () => {
    if (!undoRecordId) return;
    setIsUndoing(true);
    try {
      await attendanceApi.deleteAttendanceRecord(undoRecordId, 'تراجع سريع خلال 30 ثانية');

      // Remove from recent scans
      setRecentScans((prev) => prev.filter((s) => s.recordId !== undoRecordId));
      setLastScanResult(null);
      setUndoRecordId(null);
      setUndoSecondsLeft(0);

      // Refresh report
      if (sessionId) {
        attendanceApi.getSessionReport(sessionId).then(setReport).catch(() => {});
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل التراجع عن مسح الحضور.');
    } finally {
      setIsUndoing(false);
    }
  };

  // Record manual attendance for student in unrecorded list
  const handleManualRecord = async (
    studentId: string,
    status: 'present' | 'late' | 'excused'
  ) => {
    if (!sessionId) return;
    setManualRecordingId(studentId);
    try {
      await attendanceApi.recordAttendance(sessionId, {
        student_id: studentId,
        status,
        notes: 'تسجيل يدوي من شاشة المسح',
      });
      playAudioFeedback('success');
      triggerHaptic('success');
      const rep = await attendanceApi.getSessionReport(sessionId);
      setReport(rep);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر تسجيل حضور الطالب يدويًا.');
    } finally {
      setManualRecordingId(null);
    }
  };

  // End session and mark remaining students as absent
  const handleConfirmEndSession = async () => {
    if (!sessionId) return;
    setIsEnding(true);
    try {
      await attendanceApi.endSession(sessionId, true);
      setIsEndModalOpen(false);
      stopScanner();
      router.push('/teacher/attendance');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'فشل إنهاء الحصة.');
    } finally {
      setIsEnding(false);
    }
  };

  // Compute unrecorded students from report
  const unrecordedStudents = useMemo(() => {
    if (!report?.session?.class) return [];
    const recordedIds = new Set(report.records.map((r) => r.student_id));
    // When session report doesn't include full roster, we check records vs class
    return [];
  }, [report]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto text-start pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <Link
          href="/staff/attendance/scan"
          className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg font-medium transition-colors"
        >
          <ArrowRight size={16} />
          <span>كل حصص اليوم</span>
        </Link>

        {session && (
          <div className="flex items-center gap-2">
            <Badge variant={session.status === 'in_progress' ? 'success' : 'neutral'}>
              {session.status === 'in_progress' ? 'جارية' : 'مغلقة'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEndModalOpen(true)}
              className="text-danger border-danger/30 hover:bg-danger/10 gap-1 text-xs"
            >
              <LogOut size={14} />
              <span>إنهاء الحصة</span>
            </Button>
          </div>
        )}
      </div>

      {sessionError && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
          {sessionError}
        </div>
      )}

      {/* Session Title & KPIs */}
      {session && (
        <div className="space-y-3">
          <div>
            <h1 className="text-lg font-bold text-fg">{session.title}</h1>
            <p className="text-xs text-fg-muted">
              {session.schoolClass?.name || 'فصل غير محدد'}
              {session.classroom?.name ? ` • ${session.classroom.name}` : ''}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          {report && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-surface border border-border">
                <div className="text-xs text-fg-muted">المسجلين</div>
                <div className="text-base font-bold text-fg font-mono">
                  {formatNumber(report.summary.total_enrolled)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-success/10 border border-success/20">
                <div className="text-xs text-success">حاضر</div>
                <div className="text-base font-bold text-success font-mono">
                  {formatNumber(report.summary.present)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
                <div className="text-xs text-warning">متأخر</div>
                <div className="text-base font-bold text-warning font-mono">
                  {formatNumber(report.summary.late)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-danger/10 border border-danger/20">
                <div className="text-xs text-danger">غائب / باقٍ</div>
                <div className="text-base font-bold text-danger font-mono">
                  {formatNumber(
                    Math.max(
                      0,
                      report.summary.total_enrolled -
                        (report.summary.present + report.summary.late + report.summary.excused)
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Camera Viewfinder */}
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] max-h-[380px] flex items-center justify-center border border-border shadow-inner">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Scan Reticle Frame */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="relative w-56 h-56 border-2 border-primary/70 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Animated Scan Line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_8px_var(--color-primary)] animate-pulse" />
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-primary" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-primary" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-primary" />
            </div>
          </div>
        )}

        {/* Camera Control Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
          <Badge variant="neutral" className="bg-black/60 text-white backdrop-blur-md text-xs">
            {engine === 'native' ? 'ماسح فائق السرعة' : 'ماسح متوافق (ZXing)'}
          </Badge>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-full backdrop-blur-md text-white transition-all ${
                  isTorchOn ? 'bg-warning text-black' : 'bg-black/60 hover:bg-black/80'
                }`}
                title="تشغيل الفلاش"
              >
                <Flashlight size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={flipCamera}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all"
              title="تبديل الكاميرا"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              onClick={isScanning ? stopScanner : startScanner}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all"
              title={isScanning ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
            >
              {isScanning ? <CameraOff size={16} /> : <Camera size={16} />}
            </button>
          </div>
        </div>

        {/* Scanner Error message */}
        {scannerError && (
          <div className="absolute inset-x-4 bottom-4 p-3 rounded-lg bg-danger/90 text-white text-xs text-center backdrop-blur-md">
            {scannerError}
          </div>
        )}
      </div>

      {/* Floating Scan Result Notification & Undo Card */}
      {lastScanResult && (
        <Card
          className={`p-4 transition-all animate-in fade-in slide-in-from-top-2 border ${
            lastScanResult.type === 'success'
              ? 'border-success/40 bg-success/5'
              : lastScanResult.type === 'already'
              ? 'border-warning/40 bg-warning/5'
              : 'border-danger/40 bg-danger/5'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  lastScanResult.type === 'success'
                    ? 'bg-success/20 text-success'
                    : lastScanResult.type === 'already'
                    ? 'bg-warning/20 text-warning'
                    : 'bg-danger/20 text-danger'
                }`}
              >
                {lastScanResult.type === 'success' ? (
                  <CheckCircle2 size={20} />
                ) : lastScanResult.type === 'already' ? (
                  <AlertCircle size={20} />
                ) : (
                  <XCircle size={20} />
                )}
              </div>

              <div>
                <h4 className="font-bold text-sm text-fg">
                  {lastScanResult.studentName || lastScanResult.title}
                </h4>
                <p className="text-xs text-fg-muted">{lastScanResult.message}</p>
                {lastScanResult.studentCode && (
                  <div className="text-xs font-mono text-fg-muted mt-0.5">
                    كود: {lastScanResult.studentCode}
                  </div>
                )}
              </div>
            </div>

            {/* Undo button with countdown */}
            {undoRecordId && undoSecondsLeft > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndoLastScan}
                disabled={isUndoing}
                className="gap-1.5 text-xs text-danger hover:bg-danger/10 border-danger/30"
              >
                <RotateCcw size={14} className={isUndoing ? 'animate-spin' : ''} />
                <span>تراجع ({undoSecondsLeft} ث)</span>
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Tabs: Recent Scans vs Unrecorded */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('recent')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 ${
              activeTab === 'recent'
                ? 'border-primary text-primary'
                : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            الحاضرون مؤخراً ({recentScans.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unrecorded')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 ${
              activeTab === 'unrecorded'
                ? 'border-primary text-primary'
                : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            سجل الجلسة الكامل ({report?.records?.length || 0})
          </button>
        </div>

        {activeTab === 'recent' ? (
          recentScans.length === 0 ? (
            <div className="p-6 text-center text-fg-muted text-xs bg-surface-sunken rounded-xl">
              وجّه الكاميرا نحو بطاقة الطالب لمسح رمز الـ QR وتسجيل الحضور فوراً.
            </div>
          ) : (
            <div className="space-y-2">
              {recentScans.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-lg bg-surface border border-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-surface-sunken flex items-center justify-center font-bold text-fg">
                      {s.name.slice(0, 1)}
                    </span>
                    <div>
                      <div className="font-bold text-fg">{s.name}</div>
                      <div className="text-xs text-fg-muted font-mono">{s.code}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        s.status === 'present'
                          ? 'success'
                          : s.status === 'late'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {s.status === 'present'
                        ? 'حاضر'
                        : s.status === 'late'
                        ? 'متأخر'
                        : 'مسجل مسبقاً'}
                    </Badge>
                    <span className="text-xs font-mono text-fg-muted">{s.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Full Session Roster */
          <div className="space-y-2">
            {report?.records?.length === 0 ? (
              <div className="p-6 text-center text-fg-muted text-xs bg-surface-sunken rounded-xl">
                لم يتم تسجيل أي حضور حتى الآن في هذه الحصة.
              </div>
            ) : (
              report?.records?.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-lg bg-surface border border-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-surface-sunken flex items-center justify-center font-bold text-fg">
                      {rec.student?.user?.name?.slice(0, 1) || 'ط'}
                    </span>
                    <div>
                      <div className="font-bold text-fg">{rec.student?.user?.name || 'طالب'}</div>
                      <div className="text-xs text-fg-muted font-mono">
                        {rec.student?.student_code || ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        rec.status === 'present'
                          ? 'success'
                          : rec.status === 'late'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {rec.status === 'present'
                        ? 'حاضر'
                        : rec.status === 'late'
                        ? 'متأخر'
                        : rec.status === 'absent'
                        ? 'غائب'
                        : 'معذور'}
                    </Badge>
                    <span className="text-xs font-mono text-fg-muted">
                      {formatTime(rec.recorded_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* End Session Confirmation Modal */}
      <Modal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        title="إنهاء الحصة ورصد الغياب"
        size="md"
      >
        <div className="space-y-4 text-start">
          <p className="text-sm text-fg-muted">
            هل أنت متأكد من رغبتك في إنهاء هذه الحصة الآن؟
          </p>

          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle size={14} />
              <span>رصد تلقائي للغياب وإشعار أولياء الأمور:</span>
            </div>
            <div>
              سيتم تسجيل جميع الطلاب الذين لم يتم مسح بطاقاتهم كـ <strong>«غائب»</strong> تلقائيًا،
              وإرسال إشعار غياب فوري لأولياء أمورهم.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEndModalOpen(false)}
              disabled={isEnding}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmEndSession}
              disabled={isEnding}
              className="gap-1.5"
            >
              {isEnding ? 'جاري الإغلاق...' : 'تأكيد إنهاء الحصة ورصد الغياب'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

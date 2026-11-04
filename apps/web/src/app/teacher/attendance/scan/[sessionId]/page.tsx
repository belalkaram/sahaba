'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { attendanceApi, SessionReportData } from '../../../../../lib/attendance-api';
import type { AttendanceScanResult, ClassSession } from '../../../../../types';
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon, IconBack } from '../../../../../components/icons';

import { Flashlight, RefreshCw } from 'lucide-react';
import { formatNumber, formatPercent, formatTime } from '../../../../../lib/format';
import { partial } from '../../../../../lib/partial-failure';
interface RecentScan {
  id: string;
  name: string;
  code: string;
  status: string;
  time: string;
  isDuplicate: boolean;
}

export default function TeacherAttendanceScannerPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  // Session & Stats state
  const [session, setSession] = useState<ClassSession | null>(null);
  const [report, setReport] = useState<SessionReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [lastResult, setLastResult] = useState<{
    type: 'success' | 'already' | 'error';
    title: string;
    message: string;
    studentName?: string;
    studentCode?: string;
  } | null>(null);

  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const isProcessingScanRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sound Feedback via Web Audio API
  const playSound = useCallback((type: 'success' | 'already' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      // AudioContext policy fallback
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

  // Load Session details & live report
  const loadData = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError(null);
      const [sessData, repData] = await Promise.all([
        attendanceApi.getSession(sessionId),
        attendanceApi.getSessionReport(sessionId).catch(partial(null)),
      ]);
      setSession(sessData);
      if (repData) setReport(repData);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'تعذر تحميل بيانات الجلسة.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dispatch attendance scan
  const handleProcessScan = useCallback(
    async (scanPayload: { token?: string; qr_data?: string }) => {
      if (isProcessingScanRef.current || !sessionId) return;
      isProcessingScanRef.current = true;

      try {
        const res: AttendanceScanResult = await attendanceApi.scanAttendance(sessionId, scanPayload);

        const isDuplicate = res.already_recorded;
        const resultType = isDuplicate ? 'already' : 'success';

        playSound(resultType);
        triggerHaptic(resultType);

        setLastResult({
          type: resultType,
          title: isDuplicate ? 'مسجل مسبقاً' : 'تم تسجيل الحضور',
          message: res.message,
          studentName: res.student.name,
          studentCode: res.student.student_code,
        });

        // Add to recent scans list
        setRecentScans((prev) => [
          {
            id: res.student.id + '-' + Date.now(),
            name: res.student.name,
            code: res.student.student_code,
            status: res.student.status,
            time: formatTime(new Date()),
            isDuplicate,
          },
          ...prev.slice(0, 9),
        ]);

        // Refresh report stats if new scan
        if (!isDuplicate) {
          attendanceApi.getSessionReport(sessionId).then((rep) => setReport(rep)).catch(() => {});
        }
      } catch (err: unknown) {
        playSound('error');
        triggerHaptic('error');

        const e = err as { response?: { data?: { message?: string; error_code?: string } } };
        const msg = e.response?.data?.message || 'فشل مسح الرمز. يرجى المحاولة مجدداً.';

        setLastResult({
          type: 'error',
          title: 'فشل المسح',
          message: msg,
        });
      } finally {
        // Debounce before processing next barcode
        setTimeout(() => {
          isProcessingScanRef.current = false;
        }, 1500);
      }
    },
    [sessionId, playSound, triggerHaptic]
  );

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScanning(true);

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? (track.getCapabilities() as { torch?: boolean }) : undefined;
      setHasTorch(Boolean(capabilities?.torch));

      // Native BarcodeDetector Loop
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });

        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || isProcessingScanRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              const val = barcodes[0].rawValue.trim();
              if (val.includes('.')) {
                handleProcessScan({ token: val });
              } else {
                handleProcessScan({ qr_data: val });
              }
            }
          } catch {
            // Frame skip
          }
        }, 300);
      }
    } catch {
      setScanning(false);
    }
  }, [cameraFacing, handleProcessScan]);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setScanning(false);
    setTorchOn(false);
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const toggleCamera = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !torchOn;
        await (track as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch {
        // Torch toggle error
      }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    try {
      setSubmittingManual(true);
      const val = manualCode.trim();
      if (val.includes('.')) {
        await handleProcessScan({ token: val });
      } else {
        await handleProcessScan({ qr_data: val });
      }
      setManualCode('');
    } finally {
      setSubmittingManual(false);
    }
  };

  const presentCount = report?.summary.present ?? 0;
  const totalEnrolled = report?.summary.total_enrolled ?? 0;
  const attendanceRate = report?.summary.attendance_rate_percentage ?? 0;

  return (
    <div className="max-w-lg mx-auto py-3 space-y-4">
      {/* Top Bar with Back & Stats */}
      <div className="flex items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-sm">
        <Link
          href={`/teacher/sessions/${sessionId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary transition-colors"
        >
          <IconBack size={14} />
          العودة للجلسة
        </Link>

        {/* Live Running Counter */}
        <div className="flex items-center gap-3 text-xs">
          <div className="text-start">
            <span className="text-xs text-secondary block">نسبة الحضور</span>
            <span className="font-bold text-foreground">{formatPercent(attendanceRate)}</span>
          </div>
          <div className="h-6 w-[1px] bg-border" />
          <div className="text-start">
            <span className="text-xs text-secondary block">الحاضرون</span>
            <span className="font-mono font-bold text-primary">
              {presentCount} / {totalEnrolled}
            </span>
          </div>
        </div>
      </div>

      {/* Main Camera Viewfinder (360px compatible) */}
      <div className="relative aspect-[3/4] sm:aspect-square w-full rounded-2xl bg-black border-2 border-border overflow-hidden shadow-xl flex items-center justify-center select-none">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Viewfinder Target Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
          <div className="relative w-64 h-64 border-2 border-border rounded-2xl overflow-hidden flex items-center justify-center shadow-lg">
            {/* Animated Laser Scanning Line */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse shadow-[0_0_15px_var(--primary)]" />

            {/* Corner Markers */}
            <div className="absolute top-2 end-2 w-4 h-4 border-t-2 border-e-2 border-primary" />
            <div className="absolute top-2 start-2 w-4 h-4 border-t-2 border-s-2 border-primary" />
            <div className="absolute bottom-2 end-2 w-4 h-4 border-b-2 border-e-2 border-primary" />
            <div className="absolute bottom-2 start-2 w-4 h-4 border-b-2 border-s-2 border-primary" />
          </div>
          <span className="mt-4 text-xs font-semibold text-white/80 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
            وجّه الكاميرا نحو رمز QR لبطاقة الطالب
          </span>
        </div>

        {/* Top Controls Overlay inside Viewfinder */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-auto">
          <button
            onClick={toggleCamera}
            className="w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center backdrop-blur-md border border-border transition-transform active:scale-95 text-xs font-bold"
            title="تبديل الكاميرا (أمامية / خلفية)"
          >
            
 <RefreshCw size={16} strokeWidth={1.75} aria-hidden />
 </button>

          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-transform active:scale-95 text-xs font-bold ${
                torchOn ? 'bg-warning text-fg' : 'bg-black/60 text-white'
              }`}
              title="تشغيل / إيقاف الفلاش"
            >
              
 <Flashlight size={16} strokeWidth={1.75} aria-hidden />
 </button>
          )}
        </div>
      </div>

      {/* Result Toast / Banner */}
      {lastResult && (
        <div
          className={`p-4 rounded-[20px] border shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 flex items-start gap-3 ${
            lastResult.type === 'success'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : lastResult.type === 'already'
              ? 'bg-warning/10 border-warning/30 text-warning'
              : 'bg-danger/10 border-danger/30 text-danger'
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {lastResult.type === 'success' ? (
              <CheckCircleIcon size={20} className="text-primary" />
            ) : lastResult.type === 'already' ? (
              <AlertCircleIcon size={20} className="text-warning" />
            ) : (
              <XCircleIcon size={20} className="text-danger" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-start">
            <h4 className="text-sm font-bold">{lastResult.title}</h4>
            <p className="text-xs mt-0.5 leading-relaxed">{lastResult.message}</p>
            {lastResult.studentName && (
              <div className="mt-1 text-xs font-semibold flex items-center gap-2">
                <span>الطالب: <strong>{lastResult.studentName}</strong></span>
                {lastResult.studentCode && (
                  <span className="font-mono bg-background/50 px-2 py-0.5 rounded-xs text-xs">
                    [{lastResult.studentCode}]
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Input Fallback Form */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
        <span className="text-xs font-bold text-foreground block">
          إدخال يدوي (في حال تعذر قراءة الكاميرا)
        </span>
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="أدخل كود الطالب أو رمز الـ QR..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 bg-background border border-border rounded-lg px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={submittingManual || !manualCode.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
          >
            {submittingManual ? 'جارٍ الفحص...' : 'تسجيل'}
          </button>
        </form>
      </div>

      {/* Recent Scans Feed */}
      {recentScans.length > 0 && (
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-xs font-bold text-foreground">الطلاب المسجلون مؤخراً</h3>
            <span className="text-xs text-secondary font-mono">آخر {formatNumber(recentScans.length)} عمليات</span>
          </div>

          <div className="divide-y divide-border/60 max-h-48 overflow-y-auto">
            {recentScans.map((scan) => (
              <div key={scan.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      scan.isDuplicate ? 'bg-warning' : 'bg-primary'
                    }`}
                  />
                  <span className="font-semibold text-foreground truncate">{scan.name}</span>
                  <span className="text-xs font-mono text-secondary">[{scan.code}]</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-secondary font-mono">{scan.time}</span>
                  {scan.isDuplicate && (
                    <span className="text-xs font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-xs">
                      مكرر
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

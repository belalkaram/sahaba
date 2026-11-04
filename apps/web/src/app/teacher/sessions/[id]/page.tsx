'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { attendanceApi, SessionReportData } from '../../../../lib/attendance-api';
import type { AttendanceRecord, AttendanceRecordChange, ClassSession, Student } from '../../../../types';
import { ClockIcon, QrCodeIcon, FileTextIcon, EditIcon, UsersIcon, IconBack } from '../../../../components/icons';

import { X } from 'lucide-react';
import { formatDateTime, formatNumber, formatPercent } from '../../../../lib/format';
import { partial } from '../../../../lib/partial-failure';
export default function TeacherSessionControlPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<ClassSession | null>(null);
  const [report, setReport] = useState<SessionReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'excused'>('all');

  // Correction Modal state
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // History Modal state
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<AttendanceRecord | null>(null);

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

  // Session lifecycle actions
  const handleStartSession = async () => {
    try {
      await attendanceApi.startSession(sessionId);
      await loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر بدء الجلسة.');
    }
  };

  const handleEndSession = async () => {
    if (!confirm('هل أنت متأكد من رغبتك في إنهاء هذه الجلسة وتثبيت سجل الحضور؟')) return;
    try {
      await attendanceApi.endSession(sessionId);
      await loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر إنهاء الجلسة.');
    }
  };

  const handleCancelSession = async () => {
    if (!confirm('هل أنت متأكد من إلغاء هذه الجلسة؟')) return;
    try {
      await attendanceApi.cancelSession(sessionId);
      await loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر إلغاء الجلسة.');
    }
  };

  // Quick mark manual status
  const handleQuickMark = async (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    try {
      await attendanceApi.recordManual(sessionId, { student_id: studentId, status });
      await loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر تسجيل الحضور.');
    }
  };

  // Submit formal correction with audit reason
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord || !correctionReason.trim()) return;

    try {
      setSubmittingCorrection(true);
      await attendanceApi.correctAttendance(correctingRecord.id, {
        status: correctionStatus,
        reason: correctionReason.trim(),
      });
      setCorrectingRecord(null);
      setCorrectionReason('');
      await loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر تسجيل التعديل.');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-secondary text-sm">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
        <p>جارٍ تحميل كشف حضور الجلسة...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border text-center max-w-lg mx-auto mt-12 space-y-4">
        <h3 className="text-base font-bold text-foreground">تعذر فتح الجلسة</h3>
        <p className="text-xs text-secondary">{error || 'الجلسة المطلوبة غير موجودة.'}</p>
        <Link
          href="/teacher/sessions"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
        >
          <IconBack size={14} />
          العودة لقائمة الجلسات
        </Link>
      </div>
    );
  }

  const enrolledStudents: Student[] = session.school_class?.students || [];
  const recordsMap = new Map<string, AttendanceRecord>();
  (report?.records || session.attendance_records || []).forEach((r) => {
    recordsMap.set(r.student_id, r);
  });

  const summary = report?.summary || {
    total_enrolled: enrolledStudents.length,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    attendance_rate_percentage: 0,
  };

  // Filter roster
  const filteredStudents = enrolledStudents.filter((st) => {
    if (statusFilter === 'all') return true;
    const rec = recordsMap.get(st.id);
    const stStatus = rec?.status || 'absent';
    return stStatus === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-secondary">
        <Link href="/teacher/sessions" className="hover:text-primary transition-colors flex items-center gap-1">
          <IconBack size={14} />
          الجلسات والحصص
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground truncate max-w-xs">{session.title}</span>
      </div>

      {/* Control Room Hero Header */}
      <div className="rounded-2xl bg-card border border-border p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  session.status === 'in_progress'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : session.status === 'completed'
                    ? 'bg-surface-muted/10 text-fg-muted border border-border-strong/20'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}
              >
                {session.status === 'in_progress' ? 'جارية الآن' : session.status === 'completed' ? 'منتهية' : 'مجدولة'}
              </span>

              {session.school_class && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary/10 text-secondary border border-border">
                  المجموعة: {session.school_class.name}
                </span>
              )}

              {session.classroom && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary/10 text-secondary border border-border">
                  القاعة: {session.classroom.name}
                </span>
              )}

              <span className="text-xs text-secondary px-2 py-1 rounded-full bg-background border border-border">
                وضع الحضور: {session.attendance_mode === 'qr' ? 'QR فقط' : session.attendance_mode === 'manual' ? 'يدوي فقط' : 'QR ويدوي'}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-foreground tracking-tight">{session.title}</h1>

            <div className="flex items-center gap-2 text-xs text-secondary">
              <ClockIcon size={14} />
              <span>
                موعد البدء:{' '}
                {session.starts_at ? formatDateTime(session.starts_at) : '---'}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {session.attendance_mode !== 'manual' && session.status !== 'completed' && (
              <Link
                href={`/teacher/attendance/scan/${session.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20 transition-all"
              >
                <QrCodeIcon size={16} />
                فتح ماسح الكاميرا
              </Link>
            )}

            {session.status === 'scheduled' && (
              <button
                onClick={handleStartSession}
                className="px-4 py-2.5 rounded-md bg-success text-success-fg text-xs font-bold hover:bg-success-hover transition-colors shadow-xs"
              >
                بدء الحصة الآن
              </button>
            )}

            {session.status === 'in_progress' && (
              <button
                onClick={handleEndSession}
                className="px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-card text-foreground text-xs font-bold transition-colors"
              >
                إنهاء الحصة
              </button>
            )}

            {session.status !== 'completed' && session.status !== 'cancelled' && (
              <button
                onClick={handleCancelSession}
                className="px-3.5 py-2.5 rounded-lg border border-danger/20 text-danger hover:bg-danger/10 text-xs font-medium transition-colors"
              >
                إلغاء
              </button>
            )}
          </div>
        </div>

        {/* Live Counters Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-border/80">
          <div className="p-3.5 rounded-lg bg-background border border-border">
            <span className="text-xs text-secondary block">نسبة الحضور</span>
            <span className="text-xl font-bold font-mono text-primary mt-0.5 block">
              {formatPercent(summary.attendance_rate_percentage)}
            </span>
          </div>
          <div className="p-3.5 rounded-lg bg-background border border-border">
            <span className="text-xs text-secondary block">إجمالي المقيدين</span>
            <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
              {summary.total_enrolled}
            </span>
          </div>
          <div className="p-3.5 rounded-lg bg-background border border-border">
            <span className="text-xs text-secondary block">حاضر</span>
            <span className="text-xl font-bold font-mono text-primary mt-0.5 block">
              {summary.present}
            </span>
          </div>
          <div className="p-3.5 rounded-lg bg-background border border-border">
            <span className="text-xs text-secondary block">متأخر</span>
            <span className="text-xl font-bold font-mono text-warning mt-0.5 block">
              {summary.late}
            </span>
          </div>
          <div className="p-3.5 rounded-lg bg-background border border-border">
            <span className="text-xs text-secondary block">غياب بعذر</span>
            <span className="text-xl font-bold font-mono text-info mt-0.5 block">
              {summary.excused}
            </span>
          </div>
          <div className="p-3.5 rounded-lg bg-background border border-border">
            <span className="text-xs text-secondary block">غائب</span>
            <span className="text-xl font-bold font-mono text-danger mt-0.5 block">
              {summary.absent}
            </span>
          </div>
        </div>
      </div>

      {/* Live Roster Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <UsersIcon size={18} className="text-primary" />
            كشف حضور الطلاب في المجموعة ({formatNumber(enrolledStudents.length)})
          </h2>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-card border border-border">
            {(
              [
                { key: 'all', label: 'الكل' },
                { key: 'present', label: 'حاضر' },
                { key: 'late', label: 'متأخر' },
                { key: 'absent', label: 'غائب' },
                { key: 'excused', label: 'معذور' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1 rounded-[10px] text-xs font-medium transition-all ${
                  statusFilter === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {enrolledStudents.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-border text-xs text-secondary">
            لا يوجد طلاب مقيدون في هذه المجموعة الدراسية بعد.
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
            <div className="divide-y divide-border">
              {filteredStudents.map((st, idx) => {
                const record = recordsMap.get(st.id);
                const currentStatus = record?.status || 'absent';
                const hasChanges = (record?.changes?.length || 0) > 0;

                return (
                  <div
                    key={st.id}
                    className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-background/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-foreground block truncate">
                          {st.user?.name || 'طالب'}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-secondary mt-0.5">
                          <span className="font-mono bg-background px-1.5 py-0.5 rounded-xs border border-border">
                            {st.student_code}
                          </span>
                          {record && (
                            <span>
                              • تم الرصد عبر {record.attendance_mode === 'qr' ? 'مسح الـ QR' : 'التسجيل اليدوي'}
                            </span>
                          )}
                          {record && hasChanges && (
                            <button
                              onClick={() => setViewingHistoryRecord(record)}
                              className="text-primary hover:underline text-xs font-bold"
                            >
                              (سجل التعديلات: {formatNumber(record.changes?.length)})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Status Buttons & Correction Action */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border">
                        <button
                          onClick={() => handleQuickMark(st.id, 'present')}
                          className={`px-2.5 py-1 rounded-[10px] text-xs font-semibold transition-all ${
                            currentStatus === 'present'
                              ? 'bg-success text-success-fg shadow-xs'
                              : 'text-fg-muted hover:text-success'
                          }`}
                        >
                          حاضر
                        </button>
                        <button
                          onClick={() => handleQuickMark(st.id, 'late')}
                          className={`px-2.5 py-1 rounded-[10px] text-xs font-semibold transition-all ${
                            currentStatus === 'late'
                              ? 'bg-warning text-warning-fg shadow-xs'
                              : 'text-fg-muted hover:text-warning'
                          }`}
                        >
                          متأخر
                        </button>
                        <button
                          onClick={() => handleQuickMark(st.id, 'absent')}
                          className={`px-2.5 py-1 rounded-[10px] text-xs font-semibold transition-all ${
                            currentStatus === 'absent'
                              ? 'bg-danger text-danger-fg shadow-xs'
                              : 'text-fg-muted hover:text-danger'
                          }`}
                        >
                          غائب
                        </button>
                      </div>

                      {record && (
                        <button
                          onClick={() => {
                            setCorrectingRecord(record);
                            setCorrectionStatus(record.status);
                            setCorrectionReason('');
                          }}
                          className="px-2.5 py-1.5 rounded-md border border-border text-xs text-secondary hover:text-foreground hover:bg-background transition-colors flex items-center gap-1"
                          title="تعديل رسمي بسبب معتمد"
                        >
                          <EditIcon size={12} />
                          تصحيح
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Formal Correction Modal (R5-4) */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <EditIcon size={18} className="text-primary" />
                تصحيح حالة الحضور مع توثيق السبب
              </h2>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="text-secondary hover:text-foreground text-sm font-semibold p-1"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-4">
              <div>
                <span className="text-xs text-secondary block mb-1">الطالب:</span>
                <span className="text-sm font-bold text-foreground">
                  {correctingRecord.student?.user?.name || 'طالب'} ({correctingRecord.student?.student_code})
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">الحالة الجديدة</label>
                <select aria-label="الحالة الجديدة"
                  value={correctionStatus}
                  onChange={(e) => setCorrectionStatus(e.target.value as 'present' | 'absent' | 'late' | 'excused')}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="present">حاضر</option>
                  <option value="late">متأخر</option>
                  <option value="excused">معذور (غياب بعذر معتمد)</option>
                  <option value="absent">غائب</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  سبب التعديل والتصحيح <span className="text-danger">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="مثال: تقديم عذر طبي معتمد، أو خطأ في المسح اليدوي..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-4 py-2 rounded-lg border border-border text-xs text-secondary hover:text-foreground"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingCorrection || !correctionReason.trim()}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  {submittingCorrection ? 'جارٍ الحفظ...' : 'حفظ التصحيح'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal (R5-4) */}
      {viewingHistoryRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileTextIcon size={18} className="text-primary" />
                سجل التعديلات السابقة للحضور
              </h2>
              <button
                onClick={() => setViewingHistoryRecord(null)}
                className="text-secondary hover:text-foreground text-sm font-semibold p-1"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {viewingHistoryRecord.changes?.map((ch: AttendanceRecordChange) => (
                <div key={ch.id} className="p-3 rounded-lg bg-background border border-border space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      من <strong className="text-danger">{ch.old_status}</strong> إلى{' '}
                      <strong className="text-primary">{ch.new_status}</strong>
                    </span>
                    <span className="text-xs text-secondary font-mono">
                      {ch.created_at ? formatDateTime(ch.created_at) : '---'}
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">
                    السبب: {ch.reason}
                  </p>
                  {ch.changed_by && (
                    <span className="text-xs text-secondary block">
                      المعدل: {ch.changed_by.name}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => setViewingHistoryRecord(null)}
                className="px-4 py-2 rounded-md border border-border text-xs text-secondary hover:text-foreground"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

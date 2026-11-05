'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Award,
  Users,
  ChevronRight,
  Plus,
  Save,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { attendanceApi, SessionReportData } from '../../../../lib/attendance-api';
import { offlineApi } from '../../../../lib/offline-api';
import type {
  ClassSession,
  AttendanceRecord,
  Student,
  OfflineHomeworkCheck,
  OfflineAssessment,
} from '../../../../types';
import { Badge } from '../../../../components/ui/badge';
import { Card } from '../../../../components/ui/card';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatCard } from '../../../../components/ui/stat-card';
import { formatDateTime, formatNumber, formatPercent } from '../../../../lib/format';
import { partial } from '../../../../lib/partial-failure';

type TabKey = 'attendance' | 'homework' | 'scores';

export default function StaffSessionWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const [session, setSession] = useState<ClassSession | null>(null);
  const [report, setReport] = useState<SessionReportData | null>(null);
  const [homeworkChecks, setHomeworkChecks] = useState<OfflineHomeworkCheck[]>([]);
  const [assessments, setAssessments] = useState<OfflineAssessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [selectedAssessment, setSelectedAssessment] = useState<OfflineAssessment | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingHw, setSavingHw] = useState(false);
  const [savingScores, setSavingScores] = useState(false);

  // Homework local editable state: map studentId -> { status, note }
  const [hwState, setHwState] = useState<
    Record<string, { status: 'done' | 'partial' | 'not_done' | 'absent'; note: string }>
  >({});

  // Score local editable state: map studentId -> { score: string, is_absent: boolean, notes: string }
  const [scoresState, setScoresState] = useState<
    Record<string, { score: string; is_absent: boolean; notes: string }>
  >({});

  // Create assessment modal state
  const [isNewAssessmentOpen, setIsNewAssessmentOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMaxScore, setNewMaxScore] = useState('20');
  const [newDesc, setNewDesc] = useState('');
  const [creatingAssessment, setCreatingAssessment] = useState(false);

  const loadAll = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError(null);

      const [sessData, repData, hwData] = await Promise.all([
        attendanceApi.getSession(sessionId),
        attendanceApi.getSessionReport(sessionId).catch(partial(null)),
        offlineApi.getHomeworkChecks(sessionId).catch(partial([])),
      ]);

      setSession(sessData);
      if (repData) setReport(repData);
      setHomeworkChecks(hwData);

      // Pre-populate hwState from fetched checks
      const initialHw: Record<string, { status: 'done' | 'partial' | 'not_done' | 'absent'; note: string }> = {};
      hwData.forEach((c) => {
        initialHw[c.student_id] = { status: c.status, note: c.note || '' };
      });
      setHwState(initialHw);

      // Load assessments for this class
      if (sessData.class_id) {
        const classAssessments = await offlineApi
          .getClassOfflineAssessments(sessData.class_id)
          .catch(partial([]));
        setAssessments(classAssessments);
        if (classAssessments.length > 0) {
          const first = classAssessments[0];
          setSelectedAssessmentId(first.id);
          const full = await offlineApi.getOfflineAssessment(first.id).catch(partial(null));
          if (full) {
            setSelectedAssessment(full);
            const initialScores: Record<string, { score: string; is_absent: boolean; notes: string }> = {};
            full.scores?.forEach((s) => {
              initialScores[s.student_id] = {
                score: s.score !== null && s.score !== undefined ? String(s.score) : '',
                is_absent: !!s.is_absent,
                notes: s.notes || '',
              };
            });
            setScoresState(initialScores);
          }
        }
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'تعذر تحميل بيانات الحصة.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Load single assessment when dropdown changes
  const handleSelectAssessment = async (id: string) => {
    setSelectedAssessmentId(id);
    try {
      const full = await offlineApi.getOfflineAssessment(id);
      setSelectedAssessment(full);
      const initialScores: Record<string, { score: string; is_absent: boolean; notes: string }> = {};
      full.scores?.forEach((s) => {
        initialScores[s.student_id] = {
          score: s.score !== null && s.score !== undefined ? String(s.score) : '',
          is_absent: !!s.is_absent,
          notes: s.notes || '',
        };
      });
      setScoresState(initialScores);
    } catch {
      // ignore
    }
  };

  // Enrolled students in this class
  const classStudents = useMemo(() => {
    return session?.schoolClass?.students ?? [];
  }, [session]);

  // Quick mark attendance status
  const handleMarkAttendance = async (studentId: string, status: 'present' | 'late' | 'absent' | 'excused') => {
    try {
      await attendanceApi.recordManual(sessionId, { student_id: studentId, status });
      const [sessData, repData] = await Promise.all([
        attendanceApi.getSession(sessionId),
        attendanceApi.getSessionReport(sessionId).catch(partial(null)),
      ]);
      setSession(sessData);
      if (repData) setReport(repData);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر تسجيل الحضور.');
    }
  };

  // Quick toggle homework state for a student
  const handleSetHw = (studentId: string, status: 'done' | 'partial' | 'not_done' | 'absent') => {
    setHwState((prev) => ({
      ...prev,
      [studentId]: {
        status,
        note: prev[studentId]?.note || '',
      },
    }));
  };

  const handleSetHwNote = (studentId: string, note: string) => {
    setHwState((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'done',
        note,
      },
    }));
  };

  // Save all homework checks
  const handleSaveAllHomework = async () => {
    try {
      setSavingHw(true);
      const checksToSave = Object.entries(hwState).map(([studentId, data]) => ({
        student_id: studentId,
        status: data.status,
        note: data.note,
      }));

      if (checksToSave.length > 0) {
        await offlineApi.bulkRecordHomeworkChecks(sessionId, checksToSave);
      }
      const updated = await offlineApi.getHomeworkChecks(sessionId);
      setHomeworkChecks(updated);
      alert('تم حفظ تقييم الواجبات بنجاح.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر حفظ الواجبات.');
    } finally {
      setSavingHw(false);
    }
  };

  // Set all students to "done"
  const handleMarkAllHwDone = () => {
    const next: Record<string, { status: 'done' | 'partial' | 'not_done' | 'absent'; note: string }> = {};
    classStudents.forEach((st) => {
      next[st.id] = {
        status: 'done',
        note: hwState[st.id]?.note || '',
      };
    });
    setHwState(next);
  };

  // Save scores for selected assessment
  const handleSaveScores = async () => {
    if (!selectedAssessmentId) return;
    try {
      setSavingScores(true);
      const payload = Object.entries(scoresState).map(([studentId, data]) => ({
        student_id: studentId,
        score: data.score !== '' ? parseFloat(data.score) : undefined,
        is_absent: data.is_absent,
        notes: data.notes,
      }));

      await offlineApi.recordOfflineScores(selectedAssessmentId, payload);
      const updated = await offlineApi.getOfflineAssessment(selectedAssessmentId);
      setSelectedAssessment(updated);
      alert('تم رصد الدرجات وحفظها في كشف درجات الطلاب بنجاح.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر رصد الدرجات.');
    } finally {
      setSavingScores(false);
    }
  };

  // Create new assessment
  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.class_id || !newTitle.trim()) return;
    try {
      setCreatingAssessment(true);
      const created = await offlineApi.createOfflineAssessment(session.class_id, {
        title: newTitle.trim(),
        max_score: parseFloat(newMaxScore) || 20,
        session_id: sessionId,
        description: newDesc.trim() || undefined,
      });

      setIsNewAssessmentOpen(false);
      setNewTitle('');
      setNewDesc('');
      const classAssessments = await offlineApi.getClassOfflineAssessments(session.class_id);
      setAssessments(classAssessments);
      setSelectedAssessmentId(created.id);
      setSelectedAssessment(created);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر إنشاء الاختبار الورقي.');
    } finally {
      setCreatingAssessment(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-fg-muted">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
        <p className="mt-3 text-sm font-medium">جاري تحميل مساحة عمل الحصة...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card className="p-6 text-center border-danger/30 bg-danger-subtle">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
          <h2 className="text-lg font-bold text-fg mb-1">خطأ في التحميل</h2>
          <p className="text-sm text-fg-subtle mb-4">{error || 'لم يتم العثور على الحصة المطلوبة.'}</p>
          <Link
            href="/staff/attendance/scan"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-fg rounded-sm text-sm font-medium hover:bg-primary"
          >
            العودة لحصص اليوم
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <div className="bg-surface border border-border rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-fg-muted font-medium">
              <Link href="/staff/attendance/scan" className="hover:text-primary">
                حصص اليوم
              </Link>
              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{session.schoolClass?.name || 'الفصل الدراسي'}</span>
            </div>
            <h1 className="text-xl font-bold text-fg">{session.title || 'حصة دراسية'}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/staff/attendance/scan/${session.id}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-fg text-sm font-bold rounded-md shadow-sm hover:bg-primary active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>ماسح الكاميرا</span>
            </Link>
          </div>
        </div>

        {/* Quick Meta */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-fg-subtle pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-fg-muted" />
            <span>{session.starts_at ? formatDateTime(session.starts_at) : 'غير محدد'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-fg-muted" />
            <span>{classStudents.length} طالب مسجل</span>
          </div>
          <Badge
            variant={
              session.status === 'in_progress' ? 'brand' : session.status === 'completed' ? 'neutral' : 'warning'
            }
          >
            {session.status === 'in_progress' ? 'قيد التقدم' : session.status === 'completed' ? 'مكتملة' : 'مجدولة'}
          </Badge>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex border-b border-border bg-surface rounded-md p-1 shadow-sm gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'attendance'
              ? 'bg-primary text-primary-fg shadow-sm'
              : 'text-fg-subtle hover:text-fg hover:bg-surface-muted'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>الحضور والغياب</span>
          {report && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-current">
              {report.summary.present} / {report.summary.total_enrolled}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('homework')}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'homework'
              ? 'bg-primary text-primary-fg shadow-sm'
              : 'text-fg-subtle hover:text-fg hover:bg-surface-muted'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>متابعة الواجب</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-border text-fg">
            {Object.values(hwState).filter((h) => h.status === 'done').length} تم
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scores')}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'scores'
              ? 'bg-primary text-primary-fg shadow-sm'
              : 'text-fg-subtle hover:text-fg hover:bg-surface-muted'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>الدرجات والكويزات</span>
          {assessments.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-subtle text-accent">
              {assessments.length} كويز
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          {report && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                title="نسبة الحضور"
                value={formatPercent(report.summary.attendance_rate_percentage)}
                icon={<CheckCircle2 className="w-5 h-5" />}
                variant="emerald"
              />
              <StatCard
                title="الحاضرون"
                value={formatNumber(report.summary.present)}
                icon={<Users className="w-5 h-5" />}
                variant="indigo"
              />
              <StatCard
                title="المتأخرون"
                value={formatNumber(report.summary.late)}
                icon={<Clock className="w-5 h-5" />}
                variant="amber"
              />
              <StatCard
                title="الغائبون"
                value={formatNumber(report.summary.absent)}
                icon={<AlertCircle className="w-5 h-5" />}
                variant="purple"
              />
            </div>
          )}

          {/* Student Roster Card */}
          <Card className="p-0 overflow-hidden border-border">
            <div className="p-4 bg-surface-muted border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-fg">سجل طلاب الحصة ({classStudents.length})</h2>
              <Link
                href={`/staff/attendance/scan/${session.id}`}
                className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>فتح الماسح المباشر</span>
              </Link>
            </div>

            <div className="divide-y divide-border">
              {classStudents.map((student) => {
                const record = session.attendance_records?.find((r) => r.student_id === student.id);
                const currentStatus = record?.status || 'absent';

                return (
                  <div
                    key={student.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-surface-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-subtle text-primary flex items-center justify-center text-sm font-bold">
                        {student.user?.name ? student.user.name.charAt(0) : 'ط'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-fg">{student.user?.name || 'طالب'}</div>
                        <div className="text-xs text-fg-muted font-mono">{student.student_code}</div>
                      </div>
                    </div>

                    {/* Status Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleMarkAttendance(student.id, 'present')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          currentStatus === 'present'
                            ? 'bg-primary text-primary-fg shadow-sm'
                            : 'bg-surface-muted text-fg hover:bg-primary-subtle hover:text-primary'
                        }`}
                      >
                        حاضر
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkAttendance(student.id, 'late')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          currentStatus === 'late'
                            ? 'bg-warning text-warning-fg shadow-sm'
                            : 'bg-surface-muted text-fg hover:bg-warning-subtle hover:text-warning'
                        }`}
                      >
                        متأخر
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkAttendance(student.id, 'absent')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          currentStatus === 'absent'
                            ? 'bg-danger text-danger-fg shadow-sm'
                            : 'bg-surface-muted text-fg hover:bg-danger-subtle hover:text-danger'
                        }`}
                      >
                        غائب
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: HOMEWORK CHECKS */}
      {activeTab === 'homework' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-4 rounded-md border border-border">
            <div>
              <h2 className="text-sm font-bold text-fg">متابعة حل الواجب للحصة</h2>
              <p className="text-xs text-fg-muted">
                اضغط على زر التقييم لكل طالب (تم، جزئي، لم يحل، غائب) مع إمكانية إضافة ملاحظة.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMarkAllHwDone}
                className="px-3 py-2 bg-surface-muted text-fg rounded-md text-xs font-bold hover:bg-border"
              >
                تحديد الكل كـ «تم»
              </button>
              <button
                type="button"
                onClick={handleSaveAllHomework}
                disabled={savingHw}
                className="px-4 py-2 bg-primary text-primary-fg rounded-md text-xs font-bold hover:bg-primary flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingHw ? 'جاري الحفظ...' : 'حفظ تقييم الواجب'}</span>
              </button>
            </div>
          </div>

          <Card className="p-0 overflow-hidden border-border divide-y divide-border">
            {classStudents.map((student) => {
              const currentHw = hwState[student.id] || { status: 'done', note: '' };

              return (
                <div
                  key={student.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="w-10 h-10 rounded-full bg-info-subtle text-info flex items-center justify-center text-sm font-bold">
                      {student.user?.name ? student.user.name.charAt(0) : 'ط'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-fg">{student.user?.name || 'طالب'}</div>
                      <div className="text-xs text-fg-muted font-mono">{student.student_code}</div>
                    </div>
                  </div>

                  {/* 4 State Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetHw(student.id, 'done')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${
                        currentHw.status === 'done'
                          ? 'bg-primary text-primary-fg shadow-sm'
                          : 'bg-surface-muted text-fg hover:bg-primary-subtle hover:text-primary'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>تم بالكامل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetHw(student.id, 'partial')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        currentHw.status === 'partial'
                          ? 'bg-warning text-warning-fg shadow-sm'
                          : 'bg-surface-muted text-fg hover:bg-warning-subtle hover:text-warning'
                      }`}
                    >
                      جزئي
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetHw(student.id, 'not_done')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${
                        currentHw.status === 'not_done'
                          ? 'bg-danger text-danger-fg shadow-sm'
                          : 'bg-surface-muted text-fg hover:bg-danger-subtle hover:text-danger'
                      }`}
                    >
                      <X className="w-3 h-3" />
                      <span>لم يُحل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetHw(student.id, 'absent')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        currentHw.status === 'absent'
                          ? 'bg-surface-muted text-fg shadow-sm'
                          : 'bg-surface-muted text-fg hover:bg-border'
                      }`}
                    >
                      غائب
                    </button>
                  </div>

                  {/* Note Input */}
                  <div className="sm:w-64">
                    <input
                      type="text"
                      placeholder="ملاحظة حول الواجب..."
                      value={currentHw.note}
                      onChange={(e) => handleSetHwNote(student.id, e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
                    />
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* TAB 3: OFFLINE ASSESSMENTS & PAPER SCORES */}
      {activeTab === 'scores' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-4 rounded-md border border-border">
            <div className="flex items-center gap-3">
              <label htmlFor="assessment-select" className="text-xs font-bold text-fg whitespace-nowrap">
                اختر الاختبار الورقي:
              </label>
              <select
                id="assessment-select"
                value={selectedAssessmentId}
                onChange={(e) => handleSelectAssessment(e.target.value)}
                className="px-3 py-2 text-xs rounded-md border border-border bg-surface text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
              >
                {assessments.length === 0 && <option className="bg-surface text-fg py-1.5" value="">لا توجد اختبارات ورقية حتى الآن</option>}
                {assessments.map((a) => (
                  <option className="bg-surface text-fg py-1.5" key={a.id} value={a.id}>
                    {a.title} ({formatNumber(a.max_score)} درجة)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewAssessmentOpen(true)}
                className="px-3 py-2 bg-surface-muted text-fg rounded-md text-xs font-bold hover:bg-border flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>كويز ورقي جديد</span>
              </button>
              {selectedAssessment && (
                <button
                  type="button"
                  onClick={handleSaveScores}
                  disabled={savingScores}
                  className="px-4 py-2 bg-primary text-primary-fg rounded-md text-xs font-bold hover:bg-primary flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingScores ? 'جاري الرصد...' : 'رصد وحفظ الدرجات'}</span>
                </button>
              )}
            </div>
          </div>

          {selectedAssessment ? (
            <Card className="p-0 overflow-hidden border-border divide-y divide-border">
              <div className="p-4 bg-accent-subtle flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-fg">{selectedAssessment.title}</h3>
                  <p className="text-xs text-fg-muted">
                    الدرجة العظمى: {formatNumber(selectedAssessment.max_score)} درجة
                  </p>
                </div>
                <Badge variant="purple">ورقي في المركز</Badge>
              </div>

              {classStudents.map((student) => {
                const currentScore = scoresState[student.id] || { score: '', is_absent: false, notes: '' };
                const numericScore = parseFloat(currentScore.score);
                const pct =
                  !isNaN(numericScore) && selectedAssessment.max_score > 0
                    ? Math.round((numericScore / selectedAssessment.max_score) * 100)
                    : null;

                return (
                  <div
                    key={student.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-sm font-bold">
                        {student.user?.name ? student.user.name.charAt(0) : 'ط'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-fg">{student.user?.name || 'طالب'}</div>
                        <div className="text-xs text-fg-muted font-mono">{student.student_code}</div>
                      </div>
                    </div>

                    {/* Numeric Score Input */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor={`score-${student.id}`} className="text-xs font-medium text-fg-subtle">الدرجة:</label>
                        <input
                          id={`score-${student.id}`}
                          type="number"
                          step="0.5"
                          min="0"
                          max={selectedAssessment.max_score}
                          disabled={currentScore.is_absent}
                          value={currentScore.score}
                          onChange={(e) => {
                            const val = e.target.value;
                            setScoresState((prev) => ({
                              ...prev,
                              [student.id]: {
                                ...(prev[student.id] || { is_absent: false, notes: '' }),
                                score: val,
                              },
                            }));
                          }}
                          placeholder={`/ ${selectedAssessment.max_score}`}
                          className="w-24 px-3 py-1.5 text-xs text-center font-bold rounded-sm border border-border focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-surface-muted"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-fg-subtle cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentScore.is_absent}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setScoresState((prev) => ({
                              ...prev,
                              [student.id]: {
                                ...(prev[student.id] || { score: '', notes: '' }),
                                is_absent: checked,
                                score: checked ? '' : prev[student.id]?.score || '',
                              },
                            }));
                          }}
                          className="rounded-xs text-accent focus:ring-accent"
                        />
                        <span>غائب</span>
                      </label>

                      {pct !== null && !currentScore.is_absent && (
                        <span className="text-xs px-2 py-0.5 rounded-xs font-bold bg-surface-muted text-fg">
                          {pct}%
                        </span>
                      )}
                    </div>

                    {/* Notes Input */}
                    <div className="sm:w-56">
                      <input
                        type="text"
                        placeholder="ملاحظات الدرجة..."
                        value={currentScore.notes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScoresState((prev) => ({
                            ...prev,
                            [student.id]: {
                              ...(prev[student.id] || { score: '', is_absent: false }),
                              notes: val,
                            },
                          }));
                        }}
                        className="w-full px-3 py-1.5 text-xs rounded-sm border border-border focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
                      />
                    </div>
                  </div>
                );
              })}
            </Card>
          ) : (
            <Card className="p-8 text-center border-border">
              <FileSpreadsheet className="w-12 h-12 text-fg mx-auto mb-3" />
              <h3 className="text-sm font-bold text-fg mb-1">لا يوجد اختبار ورقي محدد</h3>
              <p className="text-xs text-fg-muted mb-4">
                أنشئ كويز ورقي لرصد الدرجات اليدوية لطلاب هذه الحصة.
              </p>
              <button
                type="button"
                onClick={() => setIsNewAssessmentOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-fg rounded-md text-xs font-bold hover:bg-accent shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء كويز ورقي الآن</span>
              </button>
            </Card>
          )}
        </div>
      )}

      {/* CREATE ASSESSMENT MODAL */}
      {isNewAssessmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-sunken/40 backdrop-blur-sm">
          <div className="bg-surface rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-fg">إنشاء كويز / اختبار ورقي</h3>
              <button
                type="button"
                onClick={() => setIsNewAssessmentOpen(false)}
                className="p-1 rounded-sm hover:bg-surface-muted text-fg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssessment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-fg mb-1">عنوان الاختبار / الكويز</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كويز الأسبوع الأول - قانون نيوتن"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fg mb-1">الدرجة العظمى (النهائية)</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={newMaxScore}
                  onChange={(e) => setNewMaxScore(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fg mb-1">وصف أو تفاصيل إضافية</label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات حول الاختبار الورقي..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewAssessmentOpen(false)}
                  className="px-4 py-2 rounded-md text-xs font-bold text-fg-subtle hover:bg-surface-muted"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingAssessment}
                  className="px-4 py-2 bg-primary text-primary-fg rounded-md text-xs font-bold hover:bg-primary disabled:opacity-50"
                >
                  {creatingAssessment ? 'جاري الإنشاء...' : 'إنشاء الاختبار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

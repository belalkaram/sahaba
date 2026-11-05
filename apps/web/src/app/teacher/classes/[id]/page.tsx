'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { attendanceApi } from '../../../../lib/attendance-api';
import { educationApi } from '../../../../lib/education-api';
import { adminApi } from '../../../../lib/admin-api';
import type { Classroom, SchoolClass, Student } from '../../../../types';
import { BuildingIcon, CalendarIcon, ClockIcon, PlusIcon, QrCodeIcon, SearchIcon, TrashIcon, UsersIcon, IconBack } from '../../../../components/icons';

import { X } from 'lucide-react';
import { formatDateTime } from '../../../../lib/format';
export default function TeacherClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params?.id as string;

  const [classData, setClassData] = useState<SchoolClass | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'students' | 'sessions'>('students');

  // Add Student Modal
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [enrollingStudentId, setEnrollingStudentId] = useState<string | null>(null);

  // Schedule Session Modal
  const [isSchedulingSession, setIsSchedulingSession] = useState(false);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionClassroomId, setSessionClassroomId] = useState('');
  const [sessionStartsAt, setSessionStartsAt] = useState('');
  const [sessionMode, setSessionMode] = useState<'both' | 'qr' | 'manual'>('both');
  const [sessionTimingMode, setSessionTimingMode] = useState<'scheduled' | 'open'>('scheduled');

  const loadData = useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await attendanceApi.getClass(classId);
      setClassData(data);

      // Load classrooms if class has a branch
      if (data.branch_id) {
        adminApi.getBranch(data.branch_id).then((b) => {
          if (b.classrooms) setClassrooms(b.classrooms);
        }).catch(() => {});
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'تعذر تحميل بيانات المجموعة.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load all students when opening Add Student modal
  const handleOpenAddStudent = async () => {
    setIsAddingStudent(true);
    try {
      const res = await educationApi.getStudents();
      setAllStudents(res);
    } catch {
      // Fallback
    }
  };

  const handleEnrollStudent = async (studentId: string) => {
    try {
      setEnrollingStudentId(studentId);
      await attendanceApi.enrollStudent(classId, studentId);
      await loadData();
      setIsAddingStudent(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر قيد الطالب في المجموعة.');
    } finally {
      setEnrollingStudentId(null);
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`هل أنت متأكد من إزالة الطالب "${studentName}" من المجموعة؟`)) return;
    try {
      await attendanceApi.removeStudent(classId, studentId);
      await loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر إزالة الطالب.');
    }
  };

  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim()) return;

    try {
      setSessionSubmitting(true);
      await attendanceApi.createSession(classId, {
        title: sessionTitle.trim(),
        classroom_id: sessionClassroomId || undefined,
        starts_at: sessionStartsAt ? new Date(sessionStartsAt).toISOString() : new Date().toISOString(),
        attendance_mode: sessionMode,
        timing_mode: sessionTimingMode,
        status: 'scheduled',
      });
      setSessionTitle('');
      setSessionClassroomId('');
      setSessionStartsAt('');
      setIsSchedulingSession(false);
      await loadData();
      setActiveTab('sessions');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'تعذر جدولة الجلسة.');
    } finally {
      setSessionSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-secondary text-sm">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
        <p>جارٍ تحميل بيانات المجموعة الدراسية...</p>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border text-center max-w-lg mx-auto mt-12 space-y-4">
        <h3 className="text-base font-bold text-foreground">تعذر فتح المجموعة</h3>
        <p className="text-xs text-secondary">{error || 'المجموعة المطلوبة غير موجودة.'}</p>
        <Link
          href="/teacher/classes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
        >
          <IconBack size={14} />
          العودة للمجموعات
        </Link>
      </div>
    );
  }

  const enrolledStudentIds = new Set((classData.students || []).map((s) => s.id));
  const availableStudents = allStudents.filter((s) => !enrolledStudentIds.has(s.id));
  const filteredAvailableStudents = availableStudents.filter((s) => {
    const q = studentSearch.toLowerCase();
    return (
      s.user?.name.toLowerCase().includes(q) ||
      s.student_code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-secondary">
        <Link href="/teacher/classes" className="hover:text-primary transition-colors flex items-center gap-1">
          <IconBack size={14} />
          المجموعات الدراسية
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground truncate max-w-xs">{classData.name}</span>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-2xl bg-card border border-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary px-2.5 py-1 rounded-sm bg-primary/10 border border-primary/20">
              {classData.code || 'CLASS'}
            </span>
            {classData.branch && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary border border-border flex items-center gap-1">
                <BuildingIcon size={12} />
                {classData.branch.name}
              </span>
            )}
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              نشطة
            </span>
          </div>

          <h1 className="text-2xl font-bold text-foreground tracking-tight">{classData.name}</h1>

          {classData.teacher?.user && (
            <p className="text-xs text-secondary">
              المعلم المسؤول: <strong className="text-foreground">{classData.teacher.user.name}</strong>
            </p>
          )}
        </div>

        {/* Quick Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenAddStudent}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-background transition-colors"
          >
            <PlusIcon size={14} />
            إضافة طالب
          </button>
          <button
            onClick={() => setIsSchedulingSession(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <CalendarIcon size={14} />
            جدولة جلسة حضور
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-[14px] text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'students'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-secondary hover:text-foreground'
          }`}
        >
          <UsersIcon size={14} />
          الطلاب المقيدون ({classData.students?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 rounded-[14px] text-xs font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'sessions'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-secondary hover:text-foreground'
          }`}
        >
          <CalendarIcon size={14} />
          الحصص والجلسات ({classData.sessions?.length ?? 0})
        </button>
      </div>

      {/* Tab 1: Students Roster */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {(!classData.students || classData.students.length === 0) ? (
            <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-3">
              <UsersIcon size={36} className="mx-auto text-secondary/40" />
              <h3 className="text-sm font-bold text-foreground">لا يوجد طلاب مقيدون في هذه المجموعة بعد</h3>
              <p className="text-xs text-secondary">
                أضف الطلاب إلى المجموعة لتتمكن من رصد حضورهم عبر بطاقة الـ QR أو كشف الحضور اليدوي.
              </p>
              <button
                onClick={handleOpenAddStudent}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
              >
                <PlusIcon size={14} />
                إضافة أول طالب
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
              <div className="divide-y divide-border">
                {classData.students.map((st, idx) => (
                  <div
                    key={st.id}
                    className="p-4 sm:px-6 flex items-center justify-between gap-3 hover:bg-background/40 transition-colors"
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
                          {st.grade_level && <span>• {st.grade_level}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRemoveStudent(st.id, st.user?.name || st.student_code)}
                        className="text-secondary hover:text-danger p-2 rounded-sm transition-colors"
                        title="إزالة من المجموعة"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Sessions List */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {(!classData.sessions || classData.sessions.length === 0) ? (
            <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-3">
              <CalendarIcon size={36} className="mx-auto text-secondary/40" />
              <h3 className="text-sm font-bold text-foreground">لم يتم جدولة أي حصص لهذه المجموعة</h3>
              <p className="text-xs text-secondary">
                جدول حصص الأسبوع أو الشهر القادم لفتح تسجيل الحضور بالماسح الضوئي.
              </p>
              <button
                onClick={() => setIsSchedulingSession(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
              >
                <PlusIcon size={14} />
                جدولة أول حصة
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classData.sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="rounded-xl bg-card border border-border p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          sess.status === 'in_progress'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : sess.status === 'completed'
                            ? 'bg-surface-muted/10 text-fg-muted border border-border-strong/20'
                            : 'bg-primary/10 text-primary border border-primary/20'
                        }`}
                      >
                        {sess.status === 'in_progress' ? 'جارية الآن' : sess.status === 'completed' ? 'منتهية' : 'مجدولة'}
                      </span>

                      {sess.classroom && (
                        <span className="text-xs text-secondary font-medium">
                          قاعة: {sess.classroom.name}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-foreground line-clamp-1">{sess.title}</h3>

                    <div className="flex items-center gap-1.5 text-xs text-secondary">
                      <ClockIcon size={13} />
                      <span>
                        {sess.starts_at ? formatDateTime(sess.starts_at) : '---'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/80 flex items-center justify-between gap-2">
                    <Link
                      href={`/staff/sessions/${sess.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs shadow-sm"
                    >
                      كشف الحضور
                    </Link>

                    <Link
                      href={`/teacher/attendance/scan/${sess.id}`}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md border border-border text-secondary hover:text-foreground hover:bg-background text-xs font-semibold"
                      title="فتح ماسح الكاميرا"
                    >
                      <QrCodeIcon size={14} />
                      الماسح
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Student Modal */}
      {isAddingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <UsersIcon size={18} className="text-primary" />
                قيد طالب في المجموعة
              </h2>
              <button
                onClick={() => setIsAddingStudent(false)}
                className="text-secondary hover:text-foreground text-sm font-semibold p-1"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <div className="relative">
              <SearchIcon size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو الكود..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-lg ps-9 pe-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-border/60">
              {filteredAvailableStudents.length === 0 ? (
                <div className="p-6 text-center text-xs text-secondary">
                  لم يتم العثور على طلاب متاحين.
                </div>
              ) : (
                filteredAvailableStudents.map((st) => (
                  <div key={st.id} className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-foreground block">{st.user?.name}</span>
                      <span className="text-xs font-mono text-secondary">[{st.student_code}]</span>
                    </div>
                    <button
                      onClick={() => handleEnrollStudent(st.id)}
                      disabled={enrollingStudentId === st.id}
                      className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      {enrollingStudentId === st.id ? 'جارٍ القيد...' : 'قيد الطالب'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => setIsAddingStudent(false)}
                className="px-4 py-2 rounded-md border border-border text-xs text-secondary hover:text-foreground"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Session Modal */}
      {isSchedulingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <CalendarIcon size={18} className="text-primary" />
                جدولة جلسة / حصة جديدة
              </h2>
              <button
                onClick={() => setIsSchedulingSession(false)}
                className="text-secondary hover:text-foreground text-sm font-semibold p-1"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <form onSubmit={handleScheduleSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  عنوان الجلسة <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مراجعة قوانين نيوتن والجاذبية"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">تاريخ وموعد البدء</label>
                <input aria-label="تاريخ وموعد البدء"
                  type="datetime-local"
                  value={sessionStartsAt}
                  onChange={(e) => setSessionStartsAt(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {classrooms.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">القاعة التدريبية</label>
                  <select aria-label="القاعة التدريبية"
                    value={sessionClassroomId}
                    onChange={(e) => setSessionClassroomId(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3.5 py-2 text-xs text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
                  >
                    <option className="bg-surface text-fg py-1.5" value="">بدون تحديد قاعة</option>
                    {classrooms.map((room) => (
                      <option className="bg-surface text-fg py-1.5" key={room.id} value={room.id}>
                        {room.name} (سعة {room.capacity} طالب)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">أسلوب الحضور</label>
                  <select aria-label="أسلوب الحضور"
                    value={sessionMode}
                    onChange={(e) => setSessionMode(e.target.value as 'both' | 'qr' | 'manual')}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
                  >
                    <option className="bg-surface text-fg py-1.5" value="both">QR ويدوي معاً</option>
                    <option className="bg-surface text-fg py-1.5" value="qr">مسح QR فقط</option>
                    <option className="bg-surface text-fg py-1.5" value="manual">تسجيل يدوي فقط</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">نافذة التوقيت</label>
                  <select aria-label="نافذة التوقيت"
                    value={sessionTimingMode}
                    onChange={(e) => setSessionTimingMode(e.target.value as 'scheduled' | 'open')}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer font-medium"
                  >
                    <option className="bg-surface text-fg py-1.5" value="scheduled">مجدولة (فترة سماح 30 د)</option>
                    <option className="bg-surface text-fg py-1.5" value="open">مفتوحة (أي وقت)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsSchedulingSession(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs text-secondary hover:text-foreground"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={sessionSubmitting}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  {sessionSubmitting ? 'جارٍ الحفظ...' : 'جدولة الجلسة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

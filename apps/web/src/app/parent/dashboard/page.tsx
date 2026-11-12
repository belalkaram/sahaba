'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { isBelowMinimum, useAttendanceMinimum } from '../../../lib/attendance-rule';
import { educationApi } from '../../../lib/education-api';
import { analyticsApi } from '../../../lib/analytics-api';
import { assessmentApi } from '../../../lib/assessment-api';
import { billingApi, SubscriptionItem } from '../../../lib/billing-api';
import type { Student, StudentAnalyticsSnapshot, Grade } from '../../../types';
import { PageHeader } from '../../../components/ui/page-header';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { StatCard } from '../../../components/ui/stat-card';

import { EmptyState } from '../../../components/ui/empty-state';
import { UserIcon, CalendarIcon, CheckCircleIcon, AwardIcon, BookOpenIcon, AlertCircleIcon, ShieldIcon, FileTextIcon, IconNext } from '../../../components/icons';

import { FileText, GraduationCap, NotebookPen, Users } from 'lucide-react';
import { formatPercent, pctValue } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function ParentDashboardPage() {
  const { user } = useAuth();
  const minAttendance = useAttendanceMinimum();
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<StudentAnalyticsSnapshot | null>(null);
  const [recentGrades, setRecentGrades] = useState<Grade[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Load children list
  useEffect(() => {
    const loadChildren = async () => {
      try {
        setLoading(true);
        const list = await educationApi.getMyChildren();
        setChildren(list);
        if (list.length > 0) {
          setSelectedChildId(list[0].id);
        }
      } catch {
        // Fallback handled
      } finally {
        setLoading(false);
      }
    };
    loadChildren();
  }, []);

  // Load selected child's metrics, grades, and subscriptions
  useEffect(() => {
    if (!selectedChildId) return;

    const loadChildData = async () => {
      try {
        setLoadingMetrics(true);
        const [snapData, gradesData, subsData] = await Promise.all([
          analyticsApi.getStudentDashboard(selectedChildId).catch(partial(null)),
          assessmentApi.getStudentGrades(selectedChildId).catch(partial([])),
          billingApi.getStudentSubscriptions(selectedChildId).catch(partial([])),
        ]);
        setSnapshot(snapData);
        setRecentGrades(gradesData.slice(0, 4));
        setSubscriptions(subsData);
      } finally {
        setLoadingMetrics(false);
      }
    };

    loadChildData();
  }, [selectedChildId]);

  const activeChild = children.find((c) => c.id === selectedChildId) || children[0] || null;
  const parentName = user?.name || 'ولي الأمر';

  // Alerts calculations
  const attendanceRate = snapshot?.attendance_rate ?? null;
  const isAttendanceLow = isBelowMinimum(attendanceRate, minAttendance);
  const hasActiveSub = subscriptions.some((s) => s.status === 'active');

  return (
    <div className="space-y-6 text-start">
      {/* Top Welcome Header */}
      <PageHeader
        title={`مرحباً بك، ${parentName}`}
        description="متابعة فورية للمسار التعليمي، سجل الحضور، وتقييمات الاختبارات والواجبات لأبنائك في الأكاديمية."
        actions={
          activeChild && (
            <Link
              href={`/parent/children/${activeChild.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
            >
              <UserIcon size={14} />
              <span>الملف الأكاديمي الشامل للابن</span>
            </Link>
          )
        }
      />

      {loading ? (
        <div className="py-20 text-center text-fg-muted text-xs">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>جارٍ تحميل بيانات الطلاب المرتبطين بحسابك...</p>
        </div>
      ) : children.length === 0 ? (
        <Card className="p-12 text-center bg-surface border border-border">
          <EmptyState
            icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
            title="لا يوجد طلاب مسجلون"
            description="لم يتم ربط أي طالب بحساب ولي الأمر بعد. يرجى التواصل مع إدارة المدرسة أو المركز لربط رقم الهوية."
          />
        </Card>
      ) : (
        <>
          {/* Child Selector Tabs (when multiple children) */}
          {children.length > 1 && (
            <div tabIndex={0} className="flex items-center gap-2 p-1.5 rounded-lg bg-surface-sunken border border-border max-w-full overflow-x-auto">
              <span className="text-xs font-semibold text-fg-muted px-3 shrink-0">اختر الابن / الابنة:</span>
              <div className="flex items-center gap-1.5">
                {children.map((ch) => {
                  const isSelected = ch.id === selectedChildId;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setSelectedChildId(ch.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                        isSelected
                          ? 'bg-primary text-primary-fg shadow-xs'
                          : 'bg-surface text-fg hover:bg-surface-raised border border-border'
                      }`}
                    >
                      <span><GraduationCap size={16} strokeWidth={1.75} aria-hidden /> {ch.user?.name || ch.student_code}</span>
                      <span className="text-xs opacity-80 font-mono">({ch.student_code})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Child Summary Strip */}
          {activeChild && (
            <Card className="p-5 bg-surface border border-border shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-lg bg-primary-subtle text-primary font-bold text-lg flex items-center justify-center shrink-0 border border-primary/20">
                    {(activeChild.user?.name || 'ط').charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-fg">
                        {activeChild.user?.name || `طالب (${activeChild.student_code})`}
                      </h2>
                      <Badge variant="success">منتظم</Badge>
                      {activeChild.grade_level && (
                        <Badge variant="neutral">{activeChild.grade_level}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-fg-muted mt-0.5">
                      كود الطالب:{' '}
                      <span className="font-mono text-fg font-semibold">{activeChild.student_code}</span>
                      {activeChild.user?.email && (
                        <span> • {activeChild.user.email}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/parent/children/${activeChild.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-fg text-xs font-semibold hover:bg-surface-raised transition-colors"
                  >
                    <span>كشف الدرجات والتقارير</span>
                    <IconNext size={12}  />
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {/* Academic Alerts Banner (Low Attendance or Expired Subscription) */}
          {isAttendanceLow && (
            <div className="p-4 rounded-lg bg-danger-subtle text-danger-subtle-fg border border-danger/30 flex items-start gap-3 text-xs leading-relaxed">
              <AlertCircleIcon size={18} className="text-danger shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-danger">تنبيه انخفاض نسبة الحضور الأكاديمي:</strong>
                نسبة حضور الطالب الحالية {formatPercent(attendanceRate)}، والأكاديمية تشترط {formatPercent(minAttendance)} على الأقل لدخول الاختبارات. يرجى حث الطالب على الانتظام في الحصص.
              </div>
            </div>
          )}

          {/* KPI Cards Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="التقييم الأكاديمي العام"
              value={pctValue(snapshot?.overall_score)}
              subtitle="المعدل التراكمي الموزون"
              icon={<AwardIcon size={18} />}
              variant="default"
            />
            <StatCard
              title="نسبة الحضور المعتمدة"
              value={pctValue(snapshot?.attendance_rate)}
              subtitle="نسبة الحضور في الجلسات"
              icon={<CalendarIcon size={18} />}
              variant={isAttendanceLow ? 'amber' : 'emerald'}
            />
            <StatCard
              title="إنجاز التكليفات والواجبات"
              value={pctValue(snapshot?.assignment_completion_rate)}
              subtitle="نسبة تسليم الواجبات المقررة"
              icon={<CheckCircleIcon size={18} />}
              variant="default"
            />
            <StatCard
              title="متوسط درجات الاختبارات"
              value={pctValue(snapshot?.exam_average)}
              subtitle="متوسط نتائج الاختبارات الدورية"
              icon={<BookOpenIcon size={18} />}
              variant="purple"
            />
          </div>

          {/* Two-Column Layout: Recent Evaluations + Subscription / Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Recent Published Evaluations */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                      <FileTextIcon size={16} className="text-primary" />
                      <span>آخر التقييمات والدرجات المرصودة</span>
                    </h3>
                    <p className="text-xs text-fg-muted mt-0.5">
                      النتائج المعتمدة من المعلمين في الاختبارات والواجبات الدراسية.
                    </p>
                  </div>
                  {activeChild && (
                    <Link
                      href={`/parent/children/${activeChild.id}?tab=grades`}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      عرض السجل الكامل
                    </Link>
                  )}
                </div>

                {loadingMetrics ? (
                  <div className="py-10 text-center text-xs text-fg-muted">جارٍ تحميل التقييمات...</div>
                ) : recentGrades.length === 0 ? (
                  <div className="py-8 text-center text-xs text-fg-muted">
                    لا توجد درجات معتمدة مرصودة للطالب في الوقت الحالي.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {recentGrades.map((g) => {
                      const isAssignment = g.gradable_type?.includes('Assignment');
                      return (
                        <div key={g.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-md bg-surface-sunken border border-border flex items-center justify-center text-fg font-bold text-xs shrink-0">
                              {isAssignment ? <NotebookPen size={16} strokeWidth={1.75} aria-hidden /> : <FileText size={16} strokeWidth={1.75} aria-hidden />}
                            </span>
                            <div>
                              <div className="font-bold text-fg">
                                {isAssignment ? 'واجب دراسي' : 'اختبار أكاديمي'}
                              </div>
                              <div className="text-xs text-fg-muted mt-0.5 flex items-center gap-2">
                                <span>الدرجة العظمى: {g.max_score}</span>
                                {g.feedback && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[200px] text-fg">
                                      ملاحظة: &quot;{g.feedback}&quot;
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-end font-mono">
                              <span className="text-sm font-bold text-primary">{g.score}</span>
                              <span className="text-fg-muted text-xs"> / {g.max_score}</span>
                            </div>
                            <Badge variant={g.percentage >= 80 ? 'success' : g.percentage >= 50 ? 'warning' : 'danger'}>
                              {formatPercent(g.percentage)}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Right 1 Col: Subscription & Academic Standing */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="p-5 bg-surface border border-border shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-fg border-b border-border pb-3 flex items-center gap-2">
                  <ShieldIcon size={16} className="text-primary" />
                  <span>حالة الاشتراك والالتحاق</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-md bg-surface-sunken border border-border">
                    <span className="text-fg-muted">الاشتراك بالأكاديمية:</span>
                    <Badge variant={hasActiveSub ? 'success' : 'neutral'}>
                      {hasActiveSub ? 'اشتراك نشط' : 'حساب أساسي'}
                    </Badge>
                  </div>

                  <div className="p-3 rounded-md bg-surface-sunken border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-fg-muted">المقررات المنضم إليها:</span>
                      <strong className="font-mono text-fg">{snapshot?.total_courses ?? 0} مقررات</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-fg-muted">المقررات المكتملة:</span>
                      <strong className="font-mono text-fg">{snapshot?.completed_courses ?? 0} مقررات</strong>
                    </div>
                  </div>

                  {activeChild && (
                    <div className="pt-2">
                      <Link
                        href={`/parent/children/${activeChild.id}`}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover transition-colors shadow-xs"
                      >
                        <span>فتح التقرير الأكاديمي المفصل</span>
                        <IconNext size={13}  />
                      </Link>
                    </div>
                  )}
                </div>
              </Card>

              {/* Quick Contact Card */}
              <Card className="p-5 bg-surface border border-border shadow-xs text-xs space-y-2">
                <h4 className="font-bold text-fg">دعم أولياء الأمور:</h4>
                <p className="text-fg-muted leading-relaxed">
                  إذا كان لديك استفسار يخص الحضور أو الدرجات، يمكنك مراجعة المعلم مباشرة عبر تبويب &quot;المعلمون&quot; في ملف الطالب الأكاديمي.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

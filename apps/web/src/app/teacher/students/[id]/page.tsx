'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { educationApi } from '../../../../lib/education-api';
import { analyticsApi } from '../../../../lib/analytics-api';
import { credentialsApi, CredentialItem } from '../../../../lib/credentials-api';
import type { Student, StudentAnalyticsSnapshot } from '../../../../types';
import { DetailLayout } from '../../../../components/layout/detail-layout';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { ProgressBar } from '../../../../components/ui/progress-bar';
import { EmptyState } from '../../../../components/ui/empty-state';
import { UserIcon, BookOpenIcon, FileTextIcon, ShieldIcon, IconNext, IconBack } from '../../../../components/icons';

import { BookOpen, KeyRound, Users } from 'lucide-react';
import { formatDate, formatDateTime, formatPercent } from '../../../../lib/format';
import { partial } from '../../../../lib/partial-failure';
import { useAuth } from '../../../../context/auth-context';
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TeacherStudentDetailPage({ params }: PageProps) {
  const { permissions } = useAuth();
  const resolvedParams = use(params);
  const studentId = resolvedParams.id;

  const [student, setStudent] = useState<Student | null>(null);
  const [snapshot, setSnapshot] = useState<StudentAnalyticsSnapshot | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!studentId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [stData, snapData, credsData] = await Promise.all([
          educationApi.getStudent(studentId),
          analyticsApi.getStudentDashboard(studentId).catch(partial(null)),
          ('credentials.view' in permissions ? credentialsApi.getStudentCredentials(studentId).catch(partial([])) : Promise.resolve([])),
        ]);

        setStudent(stData);
        setSnapshot(snapData);
        setCredentials(credsData);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message || 'تعذر تحميل بيانات الطالب.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [studentId]);

  if (loading) {
    return (
      <div className="py-24 text-center text-fg-muted text-sm">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
        <p>جارٍ تحميل السجل الأكاديمي والتحليلي للطالب...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="p-8 rounded-lg bg-surface border border-border text-center max-w-lg mx-auto mt-12">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4 font-bold text-lg">
          !
        </div>
        <h3 className="text-base font-bold text-fg">تعذر فتح ملف الطالب</h3>
        <p className="text-xs text-fg-muted mt-1.5">{error || 'الطالب المطلوب غير موجود أو لا تملك صلاحية الوصول إليه.'}</p>
        <Link
          href="/teacher/students"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors"
        >
          <IconBack size={14} />
          العودة لسجل الطلاب
        </Link>
      </div>
    );
  }

  const breadcrumbs = [
    { label: 'سجل الطلاب', href: '/teacher/students' },
    { label: student.user?.name || student.student_code },
  ];

  const statusBadge = (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-sm bg-primary-subtle border border-primary/20">
        {student.student_code}
      </span>
      {student.grade_level && (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-raised text-fg-muted border border-border">
          {student.grade_level}
        </span>
      )}
      <Badge variant={student.status === 'active' ? 'success' : 'danger'}>
        {student.status === 'active' ? 'منتظم' : 'معلق'}
      </Badge>
    </div>
  );

  const sideSummary = (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-3">
          مؤشرات الأداء التراكمي
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-fg-muted">معدل الحضور</span>
              <span className="font-bold text-fg font-mono">{formatPercent(snapshot?.attendance_rate)}</span>
            </div>
            <ProgressBar value={snapshot?.attendance_rate ?? 0} size="sm" variant={(snapshot?.attendance_rate ?? 0) >= 80 ? 'success' : 'warning'} />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-fg-muted">تسليم الواجبات</span>
              <span className="font-bold text-fg font-mono">{formatPercent(snapshot?.assignment_completion_rate)}</span>
            </div>
            <ProgressBar value={snapshot?.assignment_completion_rate ?? 0} size="sm" variant="primary" />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-fg-muted">المعدل العام</span>
              <span className="font-bold text-primary font-mono">{formatPercent(snapshot?.overall_score)}</span>
            </div>
            <ProgressBar value={snapshot?.overall_score ?? 0} size="sm" variant={(snapshot?.overall_score ?? 0) >= 75 ? 'success' : 'warning'} />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-2 text-xs">
        <span className="text-fg-muted block text-xs font-semibold">بيانات الاتصال المعتمدة:</span>
        <div className="flex justify-between py-1 border-b border-border">
          <span className="text-fg-muted">البريد:</span>
          <span className="text-fg font-mono" dir="ltr">{student.user?.email || '—'}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-border">
          <span className="text-fg-muted">الجوال:</span>
          <span className="text-fg font-mono" dir="ltr">{student.user?.phone || '—'}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-fg-muted">تاريخ التسجيل:</span>
          <span className="text-fg">
            {student.created_at ? formatDate(student.created_at) : '—'}
          </span>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <Link
          href={`/teacher/analytics`}
          className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-surface border border-border hover:bg-surface-raised text-fg text-xs font-semibold transition-colors"
        >
          <FileTextIcon size={14} />
          <span>فتح التحليلات التراكمية</span>
        </Link>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'الملف الأكاديمي' },
    { id: 'courses', label: 'المقررات المقيد بها', count: student.enrollments?.length ?? 0 },
    { id: 'credentials', label: 'الأجهزة المصرح بها', count: credentials.length },
    { id: 'parents', label: 'أولياء الأمور', count: student.parents?.length ?? 0 },
  ];

  return (
    <DetailLayout
      breadcrumbs={breadcrumbs}
      title={student.user?.name || student.student_code}
      subtitle={`كود الطالب الأكاديمي: ${student.student_code} • المقيد في: ${student.grade_level || 'المرحلة العامة'}`}
      statusBadge={statusBadge}
      sideSummary={sideSummary}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card className="p-5 bg-surface border border-border shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <UserIcon size={18} className="text-primary" />
              <span>المعلومات الشخصية والأكاديمية</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-md bg-surface-raised border border-border">
                <span className="text-fg-muted block mb-1">الاسم الكامل:</span>
                <span className="font-bold text-fg text-sm">{student.user?.name || 'طالب'}</span>
              </div>
              <div className="p-3.5 rounded-md bg-surface-raised border border-border">
                <span className="text-fg-muted block mb-1">كود الطالب في النظام:</span>
                <span className="font-mono font-bold text-primary text-sm">{student.student_code}</span>
              </div>
              <div className="p-3.5 rounded-md bg-surface-raised border border-border">
                <span className="text-fg-muted block mb-1">الصف / المرحلة الدراسية:</span>
                <span className="font-semibold text-fg">{student.grade_level || 'غير محدد'}</span>
              </div>
              <div className="p-3.5 rounded-md bg-surface-raised border border-border">
                <span className="text-fg-muted block mb-1">الحالة الأكاديمية:</span>
                <span className="font-semibold text-fg">
                  {student.status === 'active' ? 'منتظم ومفعل بالمنصة' : 'معلق أو غير مفعل'}
                </span>
              </div>
            </div>
          </Card>

          {/* Quick Enrolled Courses Preview */}
          <Card className="p-5 bg-surface border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                <BookOpenIcon size={18} className="text-primary" />
                <span>المقررات المسجلة حديثاً</span>
              </h3>
              <button
                onClick={() => setActiveTab('courses')}
                className="text-xs text-primary hover:underline font-semibold"
              >
                عرض الكل ({student.enrollments?.length ?? 0}) <IconNext size={16} />
 </button>
            </div>

            {(!student.enrollments || student.enrollments.length === 0) ? (
              <p className="text-xs text-fg-muted py-4 text-center">الطالب غير مقيد بأي مقررات دراسية حالياً.</p>
            ) : (
              <div className="divide-y divide-border">
                {student.enrollments.slice(0, 3).map((enr) => (
                  <div key={enr.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-fg">{enr.course?.title || 'مقرر دراسي'}</span>
                      <span className="text-xs text-fg-muted block font-mono">
                        {enr.course?.code}
                      </span>
                    </div>
                    <Badge variant={enr.status === 'active' ? 'success' : 'neutral'}>
                      {enr.status === 'active' ? 'نشط' : enr.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Enrolled Courses */}
      {activeTab === 'courses' && (
        <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg">قائمة المقررات المسجلة للطالب</h3>
            <span className="text-xs text-fg-muted font-mono">{student.enrollments?.length ?? 0} مقررات</span>
          </div>

          {(!student.enrollments || student.enrollments.length === 0) ? (
            <EmptyState
              icon={<BookOpen size={20} strokeWidth={1.75} aria-hidden />}
              title="لا توجد مقررات مقيدة"
              description="لم يتم قيد هذا الطالب في أي مقرر دراسي حتى الآن."
            />
          ) : (
            <div className="space-y-3">
              {student.enrollments.map((enr) => (
                <div
                  key={enr.id}
                  className="p-4 rounded-md bg-surface-raised border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                      <BookOpenIcon size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-fg">{enr.course?.title || 'مقرر'}</h4>
                      <div className="flex items-center gap-2 text-xs text-fg-muted mt-0.5">
                        <span className="font-mono">{enr.course?.code}</span>
                        <span>•</span>
                        <span>تاريخ التسجيل: {enr.enrolled_at || enr.created_at ? formatDate(enr.enrolled_at || enr.created_at!) : 'غير محدد'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={enr.status === 'active' ? 'success' : 'neutral'}>
                      {enr.status === 'active' ? 'اشتراك نشط' : enr.status}
                    </Badge>
                    {enr.course?.id && (
                      <Link
                        href={`/teacher/courses/${enr.course.id}`}
                        className="px-3 py-1.5 rounded-sm border border-border bg-surface text-fg text-xs font-semibold hover:bg-surface-raised transition-colors"
                      >
                        معاينة المقرر
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Credentials & Devices */}
      {activeTab === 'credentials' && (
        <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-fg">أجهزة الدخول والاعتماد الموثقة</h3>
              <p className="text-xs text-fg-muted mt-0.5">
                تطابق تام مع محددات الحماية §64 وقفل الحساب على جهاز معتمد واحد فقط.
              </p>
            </div>
            <Link
              href="/teacher/credentials"
              className="px-3 py-1.5 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
            >
              إدارة الأكواد والأجهزة
            </Link>
          </div>

          {credentials.length === 0 ? (
            <EmptyState
              icon={<KeyRound size={20} strokeWidth={1.75} aria-hidden />}
              title="لا توجد بيانات اعتماد أو أجهزة"
              description="لم يتم ربط أجهزة أو إصدار كود دخول مسجل لهذا الطالب بعد."
            />
          ) : (
            <div className="space-y-3">
              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="p-4 rounded-md bg-surface-raised border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                      <ShieldIcon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-fg">
                          كود الدخول: {cred.credential_code}
                        </span>
                        <Badge variant={cred.status === 'active' ? 'success' : 'danger'}>
                          {cred.status === 'active' ? 'ساري' : 'ملغي'}
                        </Badge>
                      </div>
                      <div className="text-xs text-fg-muted mt-1 space-y-0.5">
                        <div>
                          الجهاز المقيد:{' '}
                          <strong className="text-fg font-mono">
                            {cred.device_binding?.device_fingerprint
                              ? `${cred.device_binding.device_name || 'جهاز'} (${cred.device_binding.device_fingerprint.slice(0, 16)}...)`
                              : 'لم يتم ربط جهاز بعد'}
                          </strong>
                        </div>
                        {cred.device_binding?.last_used_at && (
                          <div>
                            آخر تسجيل دخول: {formatDateTime(cred.device_binding.last_used_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fg-muted font-mono">
                      {cred.activated_at ? `مفعّل منذ: ${formatDate(cred.activated_at)}` : 'لم يفعّل بعد'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab 4: Parents */}
      {activeTab === 'parents' && (
        <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg">بيانات أولياء الأمور المرتبطين</h3>
            <span className="text-xs text-fg-muted font-mono">{student.parents?.length ?? 0}</span>
          </div>

          {(!student.parents || student.parents.length === 0) ? (
            <EmptyState
              icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
              title="لا يوجد أولياء أمور مرتبطين"
              description="لم يتم ربط حساب ولي أمر بهذا الطالب حتى الآن."
            />
          ) : (
            <div className="space-y-3">
              {student.parents.map((parent) => (
                <div
                  key={parent.id}
                  className="p-4 rounded-md bg-surface-raised border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-subtle text-primary font-bold flex items-center justify-center shrink-0">
                      {parent.user?.name?.[0] || 'و'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-fg">{parent.user?.name || 'ولي أمر'}</h4>
                      <div className="flex items-center gap-3 text-xs text-fg-muted mt-0.5">
                        <span dir="ltr" className="font-mono">{parent.user?.email || '—'}</span>
                        <span>•</span>
                        <span dir="ltr" className="font-mono">{parent.user?.phone || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <Badge variant="info">صلة قرابة معتمدة</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </DetailLayout>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { useCan } from '../../../hooks/useCan';
import { assessmentApi } from '../../../lib/assessment-api';
import { attendanceApi } from '../../../lib/attendance-api';
import { educationApi } from '../../../lib/education-api';
import type { ClassSession } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { StatCard } from '../../../components/ui/stat-card';
import { PageHeader } from '../../../components/ui/page-header';
import { EmptyState } from '../../../components/ui/empty-state';
import { TaskIcon, CheckIcon, ShieldIcon, CalendarIcon, QrCodeIcon, FileTextIcon, BookOpenIcon } from '../../../components/icons';

import { CalendarDays } from 'lucide-react';
import { formatDateTime, formatNumber } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function TeachingAssistantPage() {
  const { user } = useAuth();
  const canScan = useCan('attendance.scan');
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [pendingGradingCount, setPendingGradingCount] = useState(0);
  const [coursesCount, setCoursesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssistantData = async () => {
      try {
        setLoading(true);

        const [coursesList, sessionsList] = await Promise.all([
          educationApi.getCourses().catch(partial([])),
          attendanceApi.getSessions().catch(partial([])),
        ]);

        setCoursesCount(coursesList.length);
        setSessions(sessionsList.slice(0, 5));

        // Check pending submissions across courses
        let gradingCount = 0;
        for (const c of coursesList.slice(0, 5)) {
          const assignments = await assessmentApi.getAssignments(c.id).catch(partial([]));
          for (const a of assignments) {
            const subs = await assessmentApi.getAssignmentSubmissions(c.id, a.id).catch(partial([]));
            gradingCount += subs.filter((s) => s.status === 'submitted').length;
          }
        }
        setPendingGradingCount(gradingCount);
      } finally {
        setLoading(false);
      }
    };

    loadAssistantData();
  }, []);

  const todaySessions = sessions.filter((s) => {
    if (!s.starts_at && !s.session_date) return false;
    const sessionDate = new Date(s.starts_at || s.session_date || '').toDateString();
    return sessionDate === new Date().toDateString();
  });

  return (
    <div className="space-y-6 text-start">
      {/* Header Greeting & Context */}
      <PageHeader
        title={`مرحباً ${user?.name || 'مساعد المعلم'}، مهام الإشراف والمتابعة اليوم`}
        subtitle="مكتب المساعد الأكاديمي — رصد الحضور، مسح الباركود، تصحيح التكليفات ومتابعة الجلسات الميدانية."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/teacher/attendance"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover shadow-xs transition-colors"
            >
              <QrCodeIcon size={14} />
              <span>تسجيل حضور فوري</span>
            </Link>
            <Link
              href="/teacher/grading"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-raised text-fg text-xs font-semibold transition-colors"
            >
              <FileTextIcon size={14} />
              <span>صندوق التصحيح</span>
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="حصص اليوم المجدولة"
          value={todaySessions.length}
          subtitle="جلسات تتطلب رصد الحضور"
          icon={<CalendarIcon size={18} />}
          variant="default"
        />

        <StatCard
          title="أوراق وإجابات بانتظار الرصد"
          value={pendingGradingCount}
          subtitle="تسليمات الطلاب المعلقة"
          icon={<TaskIcon size={18} />}
          variant={pendingGradingCount > 0 ? 'amber' : 'default'}
        />

        <StatCard
          title="المقررات المتاحة للمتابعة"
          value={coursesCount}
          subtitle="المقررات الدراسية النشطة"
          icon={<BookOpenIcon size={18} />}
          variant="default"
        />

        <StatCard
          title="حالة الاعتماد في المنظومة"
          value={canScan ? 'مصرّح بالمسح' : 'مساعد معتمد'}
          subtitle="وفق نطاق الصلاحيات الأكاديمية"
          icon={<ShieldIcon size={18} />}
          variant="emerald"
        />
      </div>

      {/* Two Columns: Sessions Checklist + Role Permissions Boundaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Today Sessions & Tasks */}
        <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <CalendarIcon size={16} className="text-primary" />
              <span>الحصص والجلسات المتاحة للرصد</span>
            </h3>
            <span className="text-xs text-fg-muted font-mono">{formatNumber(sessions.length)} جلسة</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-fg-muted">جارٍ تحميل الجلسات...</div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={20} strokeWidth={1.75} aria-hidden />}
              title="لا توجد جلسات مجدولة اليوم"
              description="لا توجد حصص دراسية تتطلب رصد الحضور حالياً."
            />
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 rounded-md bg-surface-raised border border-border flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h4 className="font-bold text-fg">{session.school_class?.name || 'فصل دراسي'}</h4>
                    <p className="text-xs text-fg-muted mt-0.5">
                      الموعد: {session.starts_at ? formatDateTime(session.starts_at) : 'حصة حضورية'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={session.status === 'completed' ? 'neutral' : 'success'}>
                      {session.status === 'completed' ? 'مكتملة' : 'قيد المتابعة'}
                    </Badge>
                    <Link
                      href={`/teacher/attendance/scan/${session.id}`}
                      className="px-2.5 py-1 rounded-sm bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
                    >
                      فتح الماسح
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Column: Roles & Permission Invariants */}
        <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <ShieldIcon size={16} className="text-primary" />
              <span>حدود الصلاحيات والمسؤوليات (OD-2)</span>
            </h3>
            <Badge variant="info">مساعد أكاديمي</Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-md bg-surface-raised border border-border flex items-start gap-3">
              <span className="p-1 rounded-sm bg-success-subtle text-success shrink-0 mt-0.5">
                <CheckIcon size={14} />
              </span>
              <div>
                <b className="text-fg block">تسجيل الحضور والغياب ومسح الباركود الذكي</b>
                <p className="text-fg-muted mt-0.5 leading-relaxed">
                  صلاحية كاملة لمسح أكواد الطلاب عبر كاميرا الهاتف أو الرصد اليدوي في القاعات.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-md bg-surface-raised border border-border flex items-start gap-3">
              <span className="p-1 rounded-sm bg-success-subtle text-success shrink-0 mt-0.5">
                <CheckIcon size={14} />
              </span>
              <div>
                <b className="text-fg block">تصحيح الواجبات ورصد الدرجات المبدئية</b>
                <p className="text-fg-muted mt-0.5 leading-relaxed">
                  مراجعة تسليمات وإجابات الطلاب وتدوين التقييم والملاحظات التوجيهية في صندوق التصحيح.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-md bg-surface-raised border border-border flex items-start gap-3">
              <span className="p-1 rounded-sm bg-danger-subtle text-danger shrink-0 mt-0.5">
                <ShieldIcon size={14} />
              </span>
              <div>
                <b className="text-fg block">حذف المقررات، تغيير الأسعار، أو تعديل إعدادات المؤسسة</b>
                <p className="text-fg-muted mt-0.5 leading-relaxed">
                  صلاحيات مقيدة حصرياً بمدير المؤسسة والمعلم المشرف لحماية السجلات المالية والتعليمية.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

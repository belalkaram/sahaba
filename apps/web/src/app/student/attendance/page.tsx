'use client';

/**
 * R7B — Student Attendance Page
 * Built using Design System Primitives and Semantic Tokens.
 */

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { attendanceApi } from '../../../lib/attendance-api';
import type { StudentAttendanceSummary } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/ui/page-header';
import { StatCard } from '../../../components/ui/stat-card';
import { Tabs } from '../../../components/ui/tabs';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { CalendarWeek, CalendarEvent } from '../../../components/ui/calendar-week';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { QrCodeIcon } from '../../../components/icons';

import { CalendarDays } from 'lucide-react';
import { formatDateTime, formatPercent, formatTime } from '../../../lib/format';
export default function StudentAttendancePage() {
  const [data, setData] = useState<StudentAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'excused'>('all');

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await attendanceApi.getMyAttendance();
        setData(res);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message || 'تعذر تحميل سجل الحضور.');
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();
  }, []);

  const summary = data?.summary || {
    total_records: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    attendance_rate: 100,
  };

  const filteredRecords = useMemo(() => {
    return (data?.records || []).filter((r) => {
      if (statusFilter === 'all') return true;
      return r.status === statusFilter;
    });
  }, [data, statusFilter]);

  // Convert records to CalendarEvents for CalendarWeek
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    // Records without any date cannot be placed on the calendar (never invent "today").
    return (data?.records || [])
      .filter((r) => r.session?.session_date || r.session?.starts_at || r.recorded_at)
      .map((r) => {
      const d = new Date((r.session?.session_date || r.session?.starts_at || r.recorded_at) as string);
      const dayIdx = d.getDay(); // 0 is Sunday
      const statusLabel =
        r.status === 'present'
          ? 'حاضر'
          : r.status === 'late'
          ? 'متأخر'
          : r.status === 'excused'
          ? 'معذور'
          : 'غائب';

      return {
        id: r.id,
        dayIndex: dayIdx,
        title: `${r.session?.school_class?.name || 'حصة'}: ${statusLabel}`,
        time: formatTime(d),
        category: 'attendance',
      };
    });
  }, [data]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="success">حاضر</Badge>;
      case 'late':
        return <Badge variant="warning">متأخر</Badge>;
      case 'excused':
        return <Badge variant="info">غياب بعذر</Badge>;
      case 'absent':
      default:
        return <Badge variant="danger">غائب</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="سجل الحضور والغياب الأكاديمي"
        description="متابعة دقيقة لحضورك في المجموعات والحصص الحضورية، وطرق التسجيل، ونسبة الانضباط العام."
        breadcrumbs={[
          { label: 'الرئيسية', href: '/student/dashboard' },
          { label: 'سجل الحضور' },
        ]}
        badge={
          <Badge variant={summary.attendance_rate >= 80 ? 'success' : 'warning'}>
            نسبة الحضور: {formatPercent(summary.attendance_rate)}
          </Badge>
        }
        actions={
          <Link href="/student/card">
            <Button variant="primary" className="flex items-center gap-2">
              <QrCodeIcon size={16} />
              <span>فتح بطاقة الطالب (QR)</span>
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="p-4 rounded-md bg-danger-subtle border border-danger/30 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={4} cols={6} />
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              title="نسبة الانضباط"
              value={`${summary.attendance_rate}%`}
              variant="emerald"
            />
            <StatCard
              title="إجمالي الجلسات"
              value={summary.total_records}
              variant="default"
            />
            <StatCard
              title="حاضر"
              value={summary.present}
              variant="emerald"
            />
            <StatCard
              title="متأخر"
              value={summary.late}
              variant="amber"
            />
            <StatCard
              title="غياب بعذر"
              value={summary.excused}
              variant="indigo"
            />
            <StatCard
              title="غائب"
              value={summary.absent}
              variant="purple"
            />
          </div>

          {/* Week Calendar Visualization */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-fg">جدول الحصص هذا الأسبوع</h3>
            <CalendarWeek events={calendarEvents} />
          </div>

          {/* Classes Breakdown */}
          {data?.classes && data.classes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-fg">نسبة الحضور حسب المجموعات والفصول</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.classes.map((c) => (
                  <Card key={c.class_id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-fg truncate">{c.class_name}</h4>
                      <Badge variant={c.attendance_rate >= 80 ? 'success' : 'warning'}>
                        {formatPercent(c.attendance_rate)}
                      </Badge>
                    </div>
                    <ProgressBar
                      value={c.attendance_rate}
                      variant={c.attendance_rate >= 80 ? 'success' : 'warning'}
                      size="sm"
                    />
                    <div className="flex items-center justify-between text-xs text-fg-muted pt-1">
                      <span>إجمالي الجلسات: {c.total_sessions}</span>
                      <span>حاضر: {c.present}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Records Table */}
          <Card className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-fg">السجل التفصيلي للجلسات</h3>
              <Tabs
                tabs={[
                  { id: 'all', label: 'الكل' },
                  { id: 'present', label: 'حاضر' },
                  { id: 'late', label: 'متأخر' },
                  { id: 'excused', label: 'بعذر' },
                  { id: 'absent', label: 'غائب' },
                ]}
                activeTab={statusFilter}
                onChange={(t) => setStatusFilter(t as any)}
              />
            </div>

            {filteredRecords.length === 0 ? (
              <EmptyState
                title="لا توجد سجلات مطابقة"
                description="لم يتم العثور على أي جلسات حضور تطابق معيار التصفية المحدد."
                icon={<CalendarDays size={20} strokeWidth={1.75} aria-hidden />}
              />
            ) : (
              <div tabIndex={0} className="overflow-x-auto rounded-md border border-border bg-surface">
                <table className="w-full text-start border-collapse text-xs">
                  <thead className="border-b border-border bg-surface-sunken text-fg-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">الفصل / المجموعة</th>
                      <th className="py-3 px-4">تاريخ ووقت الجلسة</th>
                      <th className="py-3 px-4">طريقة الرصد</th>
                      <th className="py-3 px-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-raised transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-fg">
                          {r.session?.school_class?.name || 'فصل دراسي'}
                        </td>
                        <td className="py-3.5 px-4 text-fg font-mono">
                          {formatDateTime(r.session?.session_date || r.session?.starts_at || r.recorded_at)}
                        </td>
                        <td className="py-3.5 px-4 text-fg-muted">
                          {r.attendance_mode === 'qr'
                            ? 'مسح باركود ذكي (QR)'
                            : r.attendance_mode === 'manual'
                            ? 'رصد يدوي بواسطة المعلم'
                            : 'نظامي'}
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(r.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

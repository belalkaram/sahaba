'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarIcon,
  CheckCircleIcon,
  BookOpenIcon,
  VideoIcon,
  ClockIcon,
  TaskIcon,
  AwardIcon,
} from '../../../components/icons';
import { formatRelative } from '../../../lib/format';
import type {
  Course,
  Meeting,
  Assignment,
  ClassSession,
  LessonProgressData,
  Lesson,
} from '../../../types';

export interface ActivityItem {
  id: string;
  type: 'attendance' | 'assignment' | 'lesson' | 'meeting';
  title: string;
  subtitle: string;
  timestamp: string; // ISO date
  statusText: string;
  statusVariant: 'success' | 'primary' | 'warning' | 'purple';
  link?: string;
}

export interface StudentActivityWidgetProps {
  sessions?: ClassSession[];
  assignments?: { course: Course; item: Assignment }[];
  meetings?: Meeting[];
  progressList?: Array<LessonProgressData & { lesson?: Lesson }>;
}

export const StudentActivityWidget: React.FC<StudentActivityWidgetProps> = ({
  sessions = [],
  assignments = [],
  meetings = [],
  progressList = [],
}) => {
  // Build unified chronological activity list
  const activities: ActivityItem[] = useMemo(() => {
    const list: ActivityItem[] = [];

    // 1. Sessions attended
    sessions.forEach((s) => {
      list.push({
        id: `sess-${s.id}`,
        type: 'attendance',
        title: s.title,
        subtitle: 'جلسة تعليمية حضورية / مسح QR',
        timestamp: s.starts_at || new Date().toISOString(),
        statusText: s.status === 'completed' ? 'تم الحضور' : 'جلسة قائمة',
        statusVariant: s.status === 'completed' ? 'success' : 'purple',
        link: '/student/attendance',
      });
    });

    // 2. Assignments
    assignments.forEach(({ course, item }) => {
      if (item.my_submission) {
        const sub = item.my_submission;
        list.push({
          id: `asgn-${item.id}`,
          type: 'assignment',
          title: item.title,
          subtitle: `مقرر ${course.title}`,
          timestamp: sub.submitted_at || item.due_at || new Date().toISOString(),
          statusText: sub.score !== undefined ? `تم التقييم (${sub.score}%)` : 'تم تسليم الواجب',
          statusVariant: 'success',
          link: `/student/assignments`,
        });
      } else if (item.due_at) {
        list.push({
          id: `asgn-${item.id}`,
          type: 'assignment',
          title: item.title,
          subtitle: `مقرر ${course.title}`,
          timestamp: item.due_at,
          statusText: 'واجب دراسي مطلوب',
          statusVariant: 'warning',
          link: `/student/assignments`,
        });
      }
    });

    // 3. Lesson Progress
    progressList.forEach((p) => {
      if (p.lesson) {
        list.push({
          id: `prog-${p.lesson.id}`,
          type: 'lesson',
          title: p.lesson.title,
          subtitle: p.completed_at ? 'تم إكمال الدرس بالكامل' : 'مشاهدة قيد المتابعة',
          timestamp: p.completed_at || new Date().toISOString(),
          statusText: p.completed_at ? 'مكتمل' : `${p.percent}% منجز`,
          statusVariant: p.completed_at ? 'success' : 'primary',
          link: `/student/courses/${p.lesson.course_id}/lessons/${p.lesson.id}`,
        });
      }
    });

    // 4. Live Meetings
    meetings.forEach((m) => {
      list.push({
        id: `meet-${m.id}`,
        type: 'meeting',
        title: m.title,
        subtitle: `محاضرة تفاعلية مباشرة (${m.duration_minutes || 60} دقيقة)`,
        timestamp: m.start_time || new Date().toISOString(),
        statusText: m.status === 'completed' ? 'منتهية' : 'مجدولة',
        statusVariant: 'purple',
        link: m.join_url,
      });
    });

    // Sort by timestamp descending
    return list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [sessions, assignments, meetings, progressList]);

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-success-subtle text-success flex items-center justify-center">
            <ClockIcon size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-fg">نشاطك التعليمي</h2>
            <p className="text-xs text-fg-muted mt-0.5">سجل التفاعل الأخير مع الدروس، المحاضرات، وتسليم التقييمات</p>
          </div>
        </div>
      </div>

      {/* Activity Timeline List */}
      {activities.length > 0 ? (
        <div className="space-y-3">
          {activities.slice(0, 5).map((act) => {
            const icon =
              act.type === 'attendance' ? (
                <CalendarIcon size={14} className="text-info" />
              ) : act.type === 'assignment' ? (
                <TaskIcon size={14} className="text-warning" />
              ) : act.type === 'meeting' ? (
                <VideoIcon size={14} className="text-primary" />
              ) : (
                <CheckCircleIcon size={14} className="text-success" />
              );

            const badgeColor =
              act.statusVariant === 'success'
                ? 'bg-success-subtle text-success border-success/20'
                : act.statusVariant === 'warning'
                ? 'bg-warning-subtle text-warning border-warning/20'
                : act.statusVariant === 'purple'
                ? 'bg-info-subtle text-info border-info/20'
                : 'bg-primary-subtle text-primary border-primary/20';

            return (
              <div
                key={act.id}
                className="flex items-start justify-between gap-3 p-3 rounded-md border border-border bg-surface-raised/40 hover:bg-surface-raised/80 transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 p-1.5 rounded-full bg-surface border border-border shadow-2xs shrink-0">
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-fg leading-tight truncate">
                      {act.title}
                    </h3>
                    <p className="text-xs text-fg-muted mt-0.5 truncate">{act.subtitle}</p>
                    <span className="text-xs text-fg-muted mt-1 block">
                      {formatRelative(act.timestamp)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${badgeColor}`}
                  >
                    {act.statusText}
                  </span>
                  {act.link && (
                    <Link href={act.link}>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        عرض
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-6 text-center">
          <ClockIcon size={24} className="mx-auto text-fg-muted mb-2" />
          <p className="text-xs font-bold text-fg">لا يوجد نشاط تعليمي مسجل مؤخراً</p>
          <p className="text-xs text-fg-muted mt-0.5">
            ابدأ بمشاهدة الدروس أو حضور المحاضرات ليتم تسجيل نشاطك هنا تلقائياً.
          </p>
        </div>
      )}
    </div>
  );
};

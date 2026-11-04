'use client';

/**
 * R7A — Teacher Dashboard Page
 * Modularized into features/teacher-dashboard/components (< 180 lines).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../context/auth-context';
import { educationApi } from '../../../lib/education-api';
import { billingApi } from '../../../lib/billing-api';
import { attendanceApi } from '../../../lib/attendance-api';
import { assessmentApi } from '../../../lib/assessment-api';
import type { Course, SchoolClass, Student } from '../../../types';
import { Skeleton } from '../../../components/ui/skeleton';
import { TeacherHeroBanner } from '../../../features/teacher-dashboard/components/teacher-hero-banner';
import { TeacherKpiGrid } from '../../../features/teacher-dashboard/components/teacher-kpi-grid';
import {
  TodaySessionsCard,
  SessionScheduleItem,
} from '../../../features/teacher-dashboard/components/today-sessions-card';
import {
  PendingTasksCard,
  PendingTaskItem,
} from '../../../features/teacher-dashboard/components/pending-tasks-card';
import { QuickActionsCard } from '../../../features/teacher-dashboard/components/quick-actions-card';

import { formatTime } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function TeacherDashboardPage() {
  const { user, permissions } = useAuth();
  const has = (permission: string) => permission in permissions;
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [pendingGradingCount, setPendingGradingCount] = useState(0);
  const [todaySessions, setTodaySessions] = useState<SessionScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [cList, clsList, pList, stList, gradingData] = await Promise.all([
          has('courses.view') ? educationApi.getCourses().catch(partial([])) : [],
          has('classes.view') ? attendanceApi.getClasses().catch(partial([])) : [],
          has('payments.view') ? billingApi.getPaymentRequests().catch(partial([])) : [],
          has('students.view') ? educationApi.getStudents().catch(partial([])) : [],
          has('assignments.grade') || has('exams.grade')
            ? assessmentApi.getPendingGrading().catch(partial(({ count: 0, submissions: [], attempts: [] })))
            : { count: 0, submissions: [], attempts: [] },
        ]);
        setCourses(cList);
        setClasses(clsList);
        setPendingPaymentsCount(pList.filter((p) => p.status === 'pending').length);
        setPendingGradingCount(gradingData.count ?? 0);
        setStudents(stList);

        const allSessions: SessionScheduleItem[] = [];
        for (const cls of clsList.slice(0, 3)) {
          const sessList = await attendanceApi.getSessions(cls.id).catch(partial([]));
          sessList.forEach((s) => {
            allSessions.push({
              id: s.id,
              className: cls.name,
              courseTitle: cls.course?.title || cls.course_id || 'مقرر',
              time: formatTime(s.session_date || s.starts_at || Date.now()),
              room: 'قاعة افتراضية / فعلية',
              status: s.status,
              enrolledCount: 0,
            });
          });
        }
        setTodaySessions(allSessions.reverse().slice(0, 5));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const teacherName = user?.name || user?.email || '';

  const pendingTasks: PendingTaskItem[] = useMemo(() => [
    {
      id: 'payments',
      title: 'مراجعة طلبات السداد البنكي',
      type: 'payment',
      count: pendingPaymentsCount,
      link: '/teacher/payments',
      urgency: pendingPaymentsCount > 0 ? 'high' : 'normal',
    },
    {
      id: 'grading',
      title: 'تصحيح الواجبات والاختبارات المقالية',
      type: 'grading',
      count: pendingGradingCount,
      link: '/teacher/grading',
      urgency: pendingGradingCount > 0 ? 'medium' : 'normal',
    },
  ], [pendingPaymentsCount, pendingGradingCount]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-start">
      <TeacherHeroBanner name={teacherName} />

      <TeacherKpiGrid
        studentsCount={students.length}
        coursesCount={courses.length}
        pendingPaymentsCount={pendingPaymentsCount}
        pendingGradingCount={pendingGradingCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TodaySessionsCard sessions={todaySessions} />
        </div>
        <div className="lg:col-span-1">
          <PendingTasksCard tasks={pendingTasks} />
        </div>
      </div>

      <QuickActionsCard />
    </div>
  );
}

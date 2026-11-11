'use client';

/**
 * R7A — Student Dashboard Page
 * Modularized into features/student-dashboard (< 180 lines).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../../context/auth-context';
import { useTenant } from '../../../context/tenant-context';
import { educationApi } from '../../../lib/education-api';
import { integrationApi } from '../../../lib/integration-api';
import { analyticsApi } from '../../../lib/analytics-api';
import { assessmentApi } from '../../../lib/assessment-api';
import { attendanceApi } from '../../../lib/attendance-api';
import type {
  Course,
  Meeting,
  StudentAnalyticsSnapshot,
  Assignment,
  ClassSession,
  LessonProgressData,
  Lesson,
} from '../../../types';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  StudentHeroBanner,
  LinkedAcademiesWidget,
  StudentKpiGrid,
  ContinueLearningCard,
  UpcomingDeadlinesWidget,
  DeadlineItem,
  SavedVideosWidget,
  StudentCoursesSection,
  StudentProgressWidget,
  StudentActivityWidget,
} from '../../../features/student-dashboard';

import { formatRelative } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
import { mapWithConcurrency } from '../../../lib/concurrency';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { setTenantSlug } = useTenant();
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressList, setProgressList] = useState<Array<LessonProgressData & { lesson?: Lesson }>>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [assignments, setAssignments] = useState<{ course: Course; item: Assignment }[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [snapshot, setSnapshot] = useState<StudentAnalyticsSnapshot | null>(null);
  const [linkedAcademies, setLinkedAcademies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [cList, progList, mList, classList, academiesData] = await Promise.all([
          educationApi.getCourses().catch(partial([])),
          educationApi.getMyProgress().catch(partial([])),
          integrationApi.getMeetings().catch(partial([])),
          attendanceApi.getClasses().catch(partial([])),
          educationApi.getStudentAcademies().catch(partial({ academies: [], total_academies: 0 })),
        ]);

        setCourses(cList);
        setProgressList(progList);
        setMeetings(mList);
        if (academiesData && academiesData.academies) {
          setLinkedAcademies(academiesData.academies);
        }

        if (cList.length > 0) {
          const allAssignments: { course: Course; item: Assignment }[] = [];
          const lists = await mapWithConcurrency(cList, 4, async (course) => ({
            course,
            aList: await assessmentApi.getAssignments(course.id).catch(partial([])),
          }));
          lists.forEach(({ course, aList }) => aList.forEach((a) => allAssignments.push({ course, item: a })));
          setAssignments(allAssignments);
        }

        if (classList.length > 0) {
          const sList = await attendanceApi.getSessions(classList[0].id).catch(partial([]));
          setSessions(sList);
        }

        if (user?.student?.id) {
          const snap = await analyticsApi.getStudentDashboard(user.student.id).catch(partial(null));
          if (snap) setSnapshot(snap);
        }
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  const studentName = user?.name || user?.email || '';
  const studentCode = user?.student?.student_code || 'بدون كود';

  const firstCourse = courses[0];
  const firstLesson = firstCourse?.lessons?.[0];
  const continueLearningData = useMemo(() => {
    if (!firstCourse) return null;
    return {
      courseTitle: firstCourse.title,
      courseCode: firstCourse.code,
      lessonTitle: firstLesson ? firstLesson.title : 'لا توجد دروس حالياً',
      lessonDuration: firstLesson?.duration_minutes ? `${firstLesson.duration_minutes} دقيقة` : 'غير محدد',
      progressPercentage: Number(snapshot?.lesson_completion_rate ?? 0),
      lastWatchedTime: snapshot?.last_activity_at ? formatRelative(snapshot.last_activity_at) : 'لا يوجد نشاط بعد',
    };
  }, [firstCourse, firstLesson, snapshot]);

  const upcomingDeadlines: DeadlineItem[] = useMemo(() => {
    return assignments
      .filter((a) => a.item.due_at && new Date(a.item.due_at) > new Date())
      .map((a) => {
        const hours = Math.round(
          (new Date(a.item.due_at!).getTime() - new Date().getTime()) / (1000 * 60 * 60)
        );
        return {
          id: a.item.id,
          title: a.item.title,
          courseTitle: a.course.title,
          type: 'assignment' as const,
          dueText: `متبقي ${hours} ساعة`,
          dueHoursRemaining: hours,
          link: '/student/assignments',
        };
      })
      .slice(0, 4);
  }, [assignments]);

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
      <StudentHeroBanner
        name={studentName}
        studentCode={studentCode}
        meetings={meetings}
      />

      <LinkedAcademiesWidget
        academies={linkedAcademies}
        onSelectTenant={(slug) => setTenantSlug(slug)}
      />

      {/* Top Academic KPIs */}
      <StudentKpiGrid snapshot={snapshot} />

      {/* Primary Academic Progress Section */}
      <StudentProgressWidget
        snapshot={snapshot}
        courses={courses}
        progressList={progressList}
      />

      {/* Quick Resume Card */}
      <ContinueLearningCard data={continueLearningData} />

      {/* Enrolled Courses (All, Current/In-Progress, Completed) with Real Data */}
      <StudentCoursesSection
        userId={user?.id}
        courses={courses}
        progressList={progressList}
      />

      {/* Saved Videos with Bookmark Capability */}
      <SavedVideosWidget
        userId={user?.id}
        courses={courses}
      />

      {/* Learning Activity & Upcoming Deadlines Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudentActivityWidget
          sessions={sessions}
          assignments={assignments}
          meetings={meetings}
          progressList={progressList}
        />
        <UpcomingDeadlinesWidget deadlines={upcomingDeadlines} />
      </div>
    </div>
  );
}

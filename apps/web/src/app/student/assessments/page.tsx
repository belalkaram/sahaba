'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { assessmentApi } from '../../../lib/assessment-api';
import { educationApi } from '../../../lib/education-api';
import type { Course } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import { ClockIcon, AlertCircleIcon, IconBack } from '../../../components/icons';

import { GraduationCap } from 'lucide-react';
import { formatDateShort, formatNumber } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
interface AssessmentItem {
  id: string;
  type: 'exam' | 'assignment';
  courseId: string;
  courseTitle: string;
  title: string;
  description?: string;
  points: number;
  dueAt?: string;
  durationMinutes?: number;
  status: string;
  isCompleted?: boolean;
  score?: number;
  maxScore?: number;
}

export default function StudentAssessmentsPage() {
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'submitted' | 'graded'>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');

  useEffect(() => {
    const loadAssessments = async () => {
      try {
        setLoading(true);
        const cList = await educationApi.getCourses().catch(partial([]));
        setCourses(cList);

        const allItems: AssessmentItem[] = [];

        for (const course of cList) {
          // Fetch course assignments
          const aList = await assessmentApi.getAssignments(course.id).catch(partial([]));
          for (const a of aList) {
            allItems.push({
              id: a.id,
              type: 'assignment',
              courseId: course.id,
              courseTitle: course.title,
              title: a.title,
              description: a.description,
              points: a.points_possible,
              dueAt: a.due_at,
              status: a.my_submission ? a.my_submission.status : 'open',
              isCompleted: Boolean(a.my_submission),
              score: a.my_submission?.score,
              maxScore: a.points_possible,
            });
          }

          // Fetch course exams
          const eList = await assessmentApi.getExams(course.id).catch(partial([]));
          for (const e of eList) {
            allItems.push({
              id: e.id,
              type: 'exam',
              courseId: course.id,
              courseTitle: course.title,
              title: e.title,
              description: e.description,
              points: e.total_points,
              dueAt: e.closes_at,
              durationMinutes: e.duration_minutes,
              status: e.status,
              isCompleted: false,
            });
          }
        }

        setItems(allItems);
      } finally {
        setLoading(false);
      }
    };

    loadAssessments();
  }, []);

  const filteredItems = items.filter((item) => {
    if (selectedCourseId !== 'all' && item.courseId !== selectedCourseId) return false;

    if (activeTab === 'submitted') return item.isCompleted && item.status !== 'graded';
    if (activeTab === 'graded') return item.status === 'graded';
    if (activeTab === 'open') return !item.isCompleted;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 text-start">
      {/* Header */}
      <PageHeader
        title="مركز الامتحانات والواجبات المدرسية"
        subtitle="تابع جميع مواعيد التسليم، الامتحانات المفتوحة، ودرجاتك المعتمدة أولاً بأول."
        actions={
          courses.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg-muted font-bold shrink-0">تصفية بالمقرر:</span>
              <select
                aria-label="تصفية حسب المقرر"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="px-3 py-1.5 rounded-md border border-border bg-surface text-fg text-xs font-semibold focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] transition-colors cursor-pointer"
              >
                <option className="bg-surface text-fg py-1.5" value="all">جميع المقررات ({formatNumber(items.length)})</option>
                {courses.map((c) => (
                  <option className="bg-surface text-fg py-1.5" key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div tabIndex={0} className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
            activeTab === 'all' ? 'bg-primary text-primary-fg shadow-xs' : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
          }`}
        >
          الكل ({formatNumber(items.length)})
        </button>
        <button
          onClick={() => setActiveTab('open')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
            activeTab === 'open' ? 'bg-primary text-primary-fg shadow-xs' : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
          }`}
        >
          مفتوح ومتاح الآن
        </button>
        <button
          onClick={() => setActiveTab('submitted')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
            activeTab === 'submitted' ? 'bg-primary text-primary-fg shadow-xs' : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
          }`}
        >
          تم التسليم
        </button>
        <button
          onClick={() => setActiveTab('graded')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
            activeTab === 'graded' ? 'bg-primary text-primary-fg shadow-xs' : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
          }`}
        >
          تم التصحيح والتقييم
        </button>
      </div>

      {/* Assessment Items Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={20} strokeWidth={1.75} aria-hidden />}
          title="لا توجد تقييمات في هذا التبويب"
          description="أنت متقدم في كافة مقرراتك الدراسية ولا توجد مهام معلقة هنا."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="p-5 flex flex-col justify-between space-y-4 hover:border-primary/40 transition-colors bg-surface border border-border shadow-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={item.type === 'exam' ? 'warning' : 'neutral'}>
                    {item.type === 'exam' ? 'امتحان إلكتروني' : 'واجب دراسي'}
                  </Badge>
                  <span className="text-xs font-bold text-fg-muted">{item.points} درجة</span>
                </div>

                <div>
                  <span className="text-xs font-bold text-primary">{item.courseTitle}</span>
                  <h3 className="text-base font-bold text-fg leading-snug">{item.title}</h3>
                </div>

                {item.description && (
                  <p className="text-xs text-fg-muted line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}

                <div className="pt-2 flex items-center gap-3 text-xs text-fg-muted border-t border-border flex-wrap">
                  {item.durationMinutes && (
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span>{item.durationMinutes} دقيقة</span>
                    </div>
                  )}

                  {item.dueAt && (
                    <div className="flex items-center gap-1 text-warning font-semibold">
                      <AlertCircleIcon className="w-3.5 h-3.5" />
                      <span>الموعد: {formatDateShort(item.dueAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                {item.score !== undefined ? (
                  <div className="text-xs font-bold text-success">
                    الدرجة: {item.score} / {item.maxScore}
                  </div>
                ) : (
                  <div className="text-xs text-fg-muted">
                    {item.isCompleted ? 'بانتظار تصحيح المعلم' : 'متاح للبدء'}
                  </div>
                )}

                {item.type === 'exam' ? (
                  <Link
                    href={`/student/exams`}
                    className="px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <span>بدء الامتحان</span>
                    <IconBack className="w-3.5 h-3.5 rotate-180" />
                  </Link>
                ) : (
                  <Link
                    href={`/student/assignments`}
                    className="px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <span>{item.isCompleted ? 'عرض التسليم' : 'تسليم الواجب'}</span>
                    <IconBack className="w-3.5 h-3.5 rotate-180" />
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

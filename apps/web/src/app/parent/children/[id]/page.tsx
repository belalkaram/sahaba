'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { educationApi } from '../../../../lib/education-api';
import { analyticsApi } from '../../../../lib/analytics-api';
import { assessmentApi } from '../../../../lib/assessment-api';
import type { Student, StudentAnalyticsSnapshot, Grade, Course } from '../../../../types';
import { DetailLayout } from '../../../../components/layout/detail-layout';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { ProgressBar } from '../../../../components/ui/progress-bar';
import { EmptyState } from '../../../../components/ui/empty-state';
import { UserIcon, BookOpenIcon, CalendarIcon, FileTextIcon } from '../../../../components/icons';

import { BookOpen, ChartColumn, FileText, NotebookPen, Presentation, Printer, TriangleAlert } from 'lucide-react';
import { formatDate, formatNumber, formatPercent } from '../../../../lib/format';
import { partial } from '../../../../lib/partial-failure';
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ParentChildDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const childId = resolvedParams.id;

  const [student, setStudent] = useState<Student | null>(null);
  const [snapshot, setSnapshot] = useState<StudentAnalyticsSnapshot | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadChildDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const [studentData, snapData, gradesData, coursesList] = await Promise.all([
          educationApi.getStudent(childId).catch(partial(null)),
          analyticsApi.getStudentDashboard(childId).catch(partial(null)),
          assessmentApi.getStudentGrades(childId).catch(partial([])),
          educationApi.getCourses().catch(partial([])),
        ]);

        if (!studentData) {
          setError('تعذر العثور على سجل الطالب المطلوب.');
          return;
        }

        setStudent(studentData);
        setSnapshot(snapData);
        setGrades(gradesData);
        setCourses(coursesList);
      } catch {
        setError('حدث خطأ أثناء تحميل السجل الأكاديمي للابن.');
      } finally {
        setLoading(false);
      }
    };

    loadChildDetails();
  }, [childId]);

  if (loading) {
    return (
      <div className="py-24 text-center text-fg-muted text-xs">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
        <p>جارٍ تحميل الملف الأكاديمي الشامل للابن...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <Card className="p-12 text-center bg-surface border border-border">
        <EmptyState
          icon={<TriangleAlert size={20} strokeWidth={1.75} aria-hidden />}
          title="تعذر تحميل ملف الطالب"
          description={error || 'الملف الأكاديمي غير متوفر حالياً.'}
          action={
            <Link
              href="/parent/children"
              className="px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-semibold"
            >
              العودة لقائمة الأبناء
            </Link>
          }
        />
      </Card>
    );
  }

  const overallScore = snapshot?.overall_score ?? null;
  const attendanceRate = snapshot?.attendance_rate ?? null;
  const assignmentRate = snapshot?.assignment_completion_rate ?? null;
  const examAverage = snapshot?.exam_average ?? null;

  const childName = student.user?.name || `طالب (${student.student_code})`;
  const studentEnrollments = student.enrollments || [];

  // Match enrolled courses with details
  const enrolledCoursesWithDetails = studentEnrollments.map((enr) => {
    const matched = courses.find((c) => c.id === enr.course_id || c.id === enr.course?.id);
    return {
      enrollment: enr,
      course: matched || enr.course,
    };
  });

  return (
    <div className="text-start">
      <DetailLayout
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/parent/dashboard' },
          { label: 'الأبناء', href: '/parent/children' },
          { label: childName },
        ]}
        avatar={
          <div className="w-14 h-14 rounded-lg bg-primary-subtle text-primary font-bold text-2xl flex items-center justify-center border border-primary/20">
            {childName.charAt(0)}
          </div>
        }
        title={childName}
        subtitle={
          <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted mt-1">
            <span>كود الطالب: <strong className="text-fg font-mono">{student.student_code}</strong></span>
            <span>•</span>
            <span>المرحلة: <strong className="text-fg">{student.grade_level || 'غير محدد'}</strong></span>
            {student.user?.email && (
              <>
                <span>•</span>
                <span>{student.user.email}</span>
              </>
            )}
          </div>
        }
        statusBadge={
          <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>
            {student.status === 'active' ? 'طالب منتظم' : student.status}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-md border border-border bg-surface text-fg text-xs font-semibold hover:bg-surface-raised transition-colors flex items-center gap-1.5"
            >
              <span><Printer size={16} strokeWidth={1.75} aria-hidden /> طباعة الشهادة / تقرير المتابعة</span>
            </button>
            <Link
              href="/parent/children"
              className="px-3.5 py-1.5 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
            >
              سجل الأبناء
            </Link>
          </div>
        }
        tabs={[
          { id: 'overview', label: 'نظرة عامة والملف' },
          { id: 'grades', label: 'كشف الدرجات والتقييمات', count: grades.length },
          { id: 'attendance', label: 'سجل الحضور والغياب' },
          { id: 'progress', label: 'المقررات ونسب الإنجاز', count: studentEnrollments.length },
          { id: 'teachers', label: 'معلمو المقررات' },
          { id: 'reports', label: 'التقرير الأكاديمي المطبوع' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sideSummary={
          <div className="space-y-4">
            <Card className="p-5 bg-surface border border-border shadow-xs space-y-4">
              <h4 className="font-bold text-xs text-fg border-b border-border pb-2.5">
                مؤشرات الأداء الأكاديمي
              </h4>

              <div className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-fg-muted">المعدل التراكمي الموزون</span>
                    <span className="font-mono font-bold text-fg">{formatPercent(overallScore)}</span>
                  </div>
                  <ProgressBar
                    value={Number(overallScore ?? 0)}
                    variant={overallScore === null || overallScore >= 50 ? (overallScore !== null && overallScore >= 80 ? 'success' : 'primary') : 'danger'}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-fg-muted">نسبة الحضور المعتمدة</span>
                    <span className="font-mono font-bold text-fg">{formatPercent(attendanceRate)}</span>
                  </div>
                  <ProgressBar
                    value={Number(attendanceRate ?? 0)}
                    variant={attendanceRate === null ? 'primary' : attendanceRate >= 75 ? 'success' : 'danger'}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-fg-muted">تسليم الواجبات</span>
                    <span className="font-mono font-bold text-fg">{formatPercent(assignmentRate)}</span>
                  </div>
                  <ProgressBar value={Number(assignmentRate ?? 0)} variant="primary" />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-fg-muted">متوسط الاختبارات</span>
                    <span className="font-mono font-bold text-fg">{formatPercent(examAverage)}</span>
                  </div>
                  <ProgressBar value={Number(examAverage ?? 0)} variant="primary" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-surface border border-border shadow-xs text-xs space-y-2">
              <h5 className="font-bold text-fg">إشعار ولي الأمر:</h5>
              <p className="text-fg-muted leading-relaxed">
                تُحدَّث مؤشرات الأداء فور رصد درجات الاختبارات أو تسجيل الحضور في القاعات من خلال المعلمين المعتمدين.
              </p>
            </Card>
          </div>
        }
      >
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-fg border-b border-border pb-3 flex items-center gap-2">
                <UserIcon size={16} className="text-primary" />
                <span>البيانات الأكاديمية والشخصية للابن</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-md bg-surface-sunken border border-border">
                  <span className="text-fg-muted block text-xs">الاسم الكامل:</span>
                  <strong className="text-fg mt-0.5 block font-semibold">{childName}</strong>
                </div>

                <div className="p-3 rounded-md bg-surface-sunken border border-border">
                  <span className="text-fg-muted block text-xs">الرقم الأكاديمي (Student Code):</span>
                  <strong className="text-fg mt-0.5 block font-mono font-semibold">{student.student_code}</strong>
                </div>

                <div className="p-3 rounded-md bg-surface-sunken border border-border">
                  <span className="text-fg-muted block text-xs">المرحلة والصف الدراسي:</span>
                  <strong className="text-fg mt-0.5 block font-semibold">{student.grade_level || 'غير محدد'}</strong>
                </div>

                <div className="p-3 rounded-md bg-surface-sunken border border-border">
                  <span className="text-fg-muted block text-xs">تاريخ التسجيل بالأكاديمية:</span>
                  <strong className="text-fg mt-0.5 block font-semibold">
                    {student.created_at ? formatDate(student.created_at) : 'مسجل بالمنظومة'}
                  </strong>
                </div>
              </div>
            </Card>

            {/* Quick KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 bg-surface border border-border shadow-xs text-center space-y-1">
                <div className="text-xs text-fg-muted">المقررات المسجلة</div>
                <div className="text-2xl font-bold font-mono text-fg">{formatNumber(studentEnrollments.length)}</div>
              </Card>
              <Card className="p-4 bg-surface border border-border shadow-xs text-center space-y-1">
                <div className="text-xs text-fg-muted">التقييمات المرصودة</div>
                <div className="text-2xl font-bold font-mono text-primary">{formatNumber(grades.length)}</div>
              </Card>
              <Card className="p-4 bg-surface border border-border shadow-xs text-center space-y-1">
                <div className="text-xs text-fg-muted">معدل الحضور</div>
                <div className="text-2xl font-bold font-mono text-primary">{formatPercent(attendanceRate)}</div>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 2: Grades & Assessments */}
        {activeTab === 'grades' && (
          <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <FileTextIcon size={16} className="text-primary" />
                  <span>كشف الدرجات الأكاديمية والتقييمات المعتمدة</span>
                </h3>
                <p className="text-xs text-fg-muted mt-0.5">
                  جميع درجات الاختبارات التحريرية والواجبات المنزلية وملاحظات المعلم.
                </p>
              </div>
              <Badge variant="neutral">{formatNumber(grades.length)} تقييم</Badge>
            </div>

            {grades.length === 0 ? (
              <EmptyState
                icon={<ChartColumn size={20} strokeWidth={1.75} aria-hidden />}
                title="لا توجد درجات مرصودة"
                description="لم يتم رصد أو اعتماد أي درجات للطالب حتى الآن."
              />
            ) : (
              <div tabIndex={0} className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-surface-sunken border-b border-border text-fg-muted">
                    <tr>
                      <th className="py-3 px-4 font-semibold">نوع التقييم</th>
                      <th className="py-3 px-4 font-semibold">الدرجة المحققة</th>
                      <th className="py-3 px-4 font-semibold">الدرجة العظمى</th>
                      <th className="py-3 px-4 font-semibold">النسبة المئوية</th>
                      <th className="py-3 px-4 font-semibold">ملاحظات المعلم</th>
                      <th className="py-3 px-4 font-semibold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {grades.map((grade) => {
                      const isAssignment = grade.gradable_type?.includes('Assignment');
                      return (
                        <tr key={grade.id} className="hover:bg-surface-raised transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-fg flex items-center gap-2">
                            <span>{isAssignment ? <><NotebookPen size={16} strokeWidth={1.75} aria-hidden /> واجب دراسي</> : <><FileText size={16} strokeWidth={1.75} aria-hidden /> اختبار أكاديمي</>}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-primary">
                            {grade.score}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-fg-muted">
                            {grade.max_score}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold">
                            <span className={grade.percentage >= 80 ? 'text-success' : grade.percentage >= 50 ? 'text-warning' : 'text-danger'}>
                              {formatPercent(grade.percentage)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-fg-muted max-w-[220px]">
                            {grade.feedback ? `"${grade.feedback}"` : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant={grade.is_published ? 'success' : 'neutral'}>
                              {grade.is_published ? 'معتمد' : 'مسودة'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Tab 3: Attendance */}
        {activeTab === 'attendance' && (
          <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <CalendarIcon size={16} className="text-primary" />
                  <span>سجل الحضور والغياب في الجلسات</span>
                </h3>
                <p className="text-xs text-fg-muted mt-0.5">
                  رصد دقيق وموثق للحضور الحضوري وعبر مسح الـ QR الذكي.
                </p>
              </div>
              <Badge variant={attendanceRate === null ? 'neutral' : attendanceRate >= 75 ? 'success' : 'danger'}>
                {formatPercent(attendanceRate)} نسبة الحضور
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-surface-sunken border border-border space-y-2">
                <span className="text-xs text-fg-muted">حالة الانتظام:</span>
                <div className="text-base font-bold text-fg">
                  {attendanceRate === null ? 'لم يُسجَّل حضور بعد' : attendanceRate >= 75 ? 'منتظم في الحضور الأكاديمي' : 'يحتاج إلى تحسين الحضور'}
                </div>
                <p className="text-xs text-fg-muted leading-relaxed">
                  يُشترط الحصول على نسبة حضور لا تقل عن 75% للتأهل للاختبارات النهائية للمقررات.
                </p>
              </div>

              <div className="p-4 rounded-md bg-surface-sunken border border-border space-y-2">
                <span className="text-xs text-fg-muted">آلية تسجيل الحضور:</span>
                <div className="text-base font-bold text-fg">
                  بطاقة الطالب الذكية (Smart QR ID)
                </div>
                <p className="text-xs text-fg-muted leading-relaxed">
                  يقوم الطالب بمسح رمز QR الفريد الخاص به في القاعة عند بداية كل حصة لتوثيق الحضور فورياً.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Tab 4: Progress & Enrolled Courses */}
        {activeTab === 'progress' && (
          <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <BookOpenIcon size={16} className="text-primary" />
                  <span>المقررات الدراسية ونسب الإنجاز</span>
                </h3>
                <p className="text-xs text-fg-muted mt-0.5">
                  متابعة تقدم الطالب في وحدات ودروس المنهج الدراسي.
                </p>
              </div>
              <Badge variant="neutral">{formatNumber(studentEnrollments.length)} مقررات</Badge>
            </div>

            {enrolledCoursesWithDetails.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={20} strokeWidth={1.75} aria-hidden />}
                title="لا توجد مقررات ملتحق بها"
                description="لم يتم تسجيل الطالب في أي مقرر دراسي حتى الآن."
              />
            ) : (
              <div className="space-y-3">
                {enrolledCoursesWithDetails.map(({ enrollment, course }) => (
                  <div
                    key={enrollment.id}
                    className="p-4 rounded-md bg-surface-sunken border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                        <BookOpenIcon size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-fg">{course?.title || 'مقرر دراسي'}</h4>
                        <div className="flex items-center gap-2 text-xs text-fg-muted mt-0.5">
                          {course?.code && <span className="font-mono">{course.code}</span>}
                          <span>•</span>
                          <span>المستوى: {(course as Course)?.level || 'عام'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={enrollment.status === 'active' ? 'success' : 'neutral'}>
                        {enrollment.status === 'active' ? 'نشط' : enrollment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 5: Teachers Contact */}
        {activeTab === 'teachers' && (
          <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                <UserIcon size={16} className="text-primary" />
                <span>معلمو المقررات المسجلة</span>
              </h3>
              <p className="text-xs text-fg-muted mt-0.5">
                قائمة المعلمين المعتمدين المشرفين على تدريس المقررات الدراسية للابن.
              </p>
            </div>

            {enrolledCoursesWithDetails.length === 0 ? (
              <EmptyState
                icon={<Presentation size={20} strokeWidth={1.75} aria-hidden />}
                title="لا يوجد معلمون مسجلون"
                description="لا توجد بيانات للمعلمين حالياً نظراً لعدم تسجيل مقررات دراسية."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {enrolledCoursesWithDetails.map(({ enrollment, course }) => (
                  <div
                    key={enrollment.id}
                    className="p-4 rounded-md bg-surface-sunken border border-border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-fg">{course?.title || 'المقرر الدراسي'}</h4>
                      <Badge variant="neutral">{course?.code || 'COURSE'}</Badge>
                    </div>
                    <div className="text-xs text-fg-muted space-y-1">
                      <div>المسؤول الأكاديمي: <strong className="text-fg">هيئة التدريس بالأكاديمية</strong></div>
                      <div>نظام المتابعة: <strong className="text-fg">تقييم مستمر واختبارات دورية</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab 6: Formal Printable Report */}
        {activeTab === 'reports' && (
          <Card className="p-8 bg-surface border border-border shadow-xs space-y-6 print:p-0 print:border-none">
            <div className="text-center border-b border-border pb-6 space-y-2">
              <h2 className="text-xl font-bold text-fg">تقرير الأداء الأكاديمي والمتابعة الشاملة</h2>
              <p className="text-xs text-fg-muted">
                كشف رسمي صادر من المنظومة التعليمية لولي أمر الطالب
              </p>
              <div className="text-xs font-mono text-fg-muted">
                تاريخ الإصدار: {formatDate(new Date())}
              </div>
            </div>

            {/* Student Formal Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-md bg-surface-sunken border border-border text-xs">
              <div>
                <span className="text-fg-muted block text-xs">اسم الطالب:</span>
                <strong className="text-fg">{childName}</strong>
              </div>
              <div>
                <span className="text-fg-muted block text-xs">الرقم الأكاديمي:</span>
                <strong className="text-fg font-mono">{student.student_code}</strong>
              </div>
              <div>
                <span className="text-fg-muted block text-xs">المرحلة:</span>
                <strong className="text-fg">{student.grade_level || 'غير محدد'}</strong>
              </div>
              <div>
                <span className="text-fg-muted block text-xs">المعدل العام:</span>
                <strong className="text-primary font-bold">{formatPercent(overallScore)}</strong>
              </div>
            </div>

            {/* Scores Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-fg">ملخص النتائج المعتمدة:</h4>
              <table className="w-full text-start text-xs border border-border rounded-md overflow-hidden">
                <thead className="bg-surface-sunken text-fg-muted">
                  <tr>
                    <th className="p-3">التقييم</th>
                    <th className="p-3">الدرجة المحققة</th>
                    <th className="p-3">الدرجة العظمى</th>
                    <th className="p-3">النسبة</th>
                    <th className="p-3">التقدير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {grades.map((g) => (
                    <tr key={g.id}>
                      <td className="p-3 font-semibold text-fg">
                        {g.gradable_type?.includes('Assignment') ? 'واجب دراسي' : 'اختبار أكاديمي'}
                      </td>
                      <td className="p-3 font-mono font-bold text-primary">{g.score}</td>
                      <td className="p-3 font-mono text-fg-muted">{g.max_score}</td>
                      <td className="p-3 font-mono">{formatPercent(g.percentage)}</td>
                      <td className="p-3">
                        <Badge variant={g.percentage >= 80 ? 'success' : g.percentage >= 50 ? 'warning' : 'danger'}>
                          {g.percentage >= 90 ? 'ممتاز' : g.percentage >= 80 ? 'جيد جداً' : g.percentage >= 65 ? 'جيد' : g.percentage >= 50 ? 'مقبول' : 'ضعيف'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Print Trigger */}
            <div className="pt-4 flex justify-end print:hidden">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-md bg-primary text-primary-fg text-xs font-bold hover:bg-primary-hover transition-colors shadow-xs"
              >
                
 <Printer size={16} strokeWidth={1.75} aria-hidden /> طباعة هذا التقرير الآن
 </button>
            </div>
          </Card>
        )}
      </DetailLayout>
    </div>
  );
}

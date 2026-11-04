'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { educationApi } from '../../../lib/education-api';
import { analyticsApi } from '../../../lib/analytics-api';
import type { Student, StudentAnalyticsSnapshot } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { Drawer } from '../../../components/ui/drawer';
import { Input } from '../../../components/ui/input';
import { PageHeader } from '../../../components/ui/page-header';
import { IconNext } from '../../../components/icons';

import { Users } from 'lucide-react';
import { formatNumber, formatPercent } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
interface StudentProfile extends Student {
  analytics?: StudentAnalyticsSnapshot;
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        const stList = await educationApi.getStudents().catch(partial([]));

        // Fetch analytics for students concurrently
        const profiles: StudentProfile[] = await Promise.all(
          stList.map(async (st) => {
            const snap = await analyticsApi.getStudentDashboard(st.id).catch(partial(null));
            return { ...st, analytics: snap || undefined };
          })
        );

        setStudents(profiles);
      } finally {
        setLoading(false);
      }
    };
    loadStudents();
  }, []);

  const filteredStudents = students.filter((s) => {
    const name = s.user?.name || '';
    const email = s.user?.email || '';
    const phone = s.user?.phone || '';

    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery);

    const matchesGrade = gradeFilter === 'ALL' || s.grade_level === gradeFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

    return matchesSearch && matchesGrade && matchesStatus;
  });

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <PageHeader
        title="شؤون الطلبة والتسجيل الأكاديمي"
        subtitle="دليل الطلاب الأكاديمي، سجل الحضور، بيانات التواصل الموثقة، ومتابعة الأجهزة المصرح بها."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="success">إجمالي المقيدين: {formatNumber(students.length)} طالب</Badge>
            <Badge variant="info">نشط: {students.filter((s) => s.status === 'active').length}</Badge>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-surface border-border shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="بحث بالاسم، كود الطالب، البريد، أو الجوال..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />

          <select
            aria-label="تصفية حسب الصف"
              value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">جميع الصفوف الدراسية</option>
            <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
            <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
            <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
          </select>

          <select
            aria-label="تصفية حسب الحالة"
              value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">جميع الحالات الأكاديمية</option>
            <option value="active">منتظم (Active)</option>
            <option value="suspended">معلق / تنبيه (Suspended)</option>
          </select>
        </div>
      </Card>

      {/* Main Students Table */}
      <Card className="p-6 bg-surface border border-border shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-fg">قائمة الطلاب المسجلين بالمنظومة</h2>
          <span className="text-xs text-fg-muted">انقر على أي طالب لعرض ملفه الأكاديمي المفصل</span>
        </div>

        {loading ? (
          <div className="text-center text-xs text-fg-muted py-12">
            <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
            <p>جارٍ تحميل بيانات الطلاب...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
            title="لا يوجد طلاب مطابقون"
            description="لم يتم العثور على أي طلاب مطابقين لشروط البحث والتصفية."
          />
        ) : (
          <div tabIndex={0} className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-surface-raised text-fg-muted font-semibold">
                <tr>
                  <th className="py-3 px-3">كود الطالب</th>
                  <th className="py-3 px-3">الاسم الكامل</th>
                  <th className="py-3 px-3">الصف الدراسي</th>
                  <th className="py-3 px-3">نسبة الحضور</th>
                  <th className="py-3 px-3">المعدل العام</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className="hover:bg-surface-raised/60 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-3 font-mono font-bold text-primary">
                      {student.student_code}
                    </td>
                    <td className="py-4 px-3 font-semibold text-fg">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary-subtle border border-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {(student.user?.name || 'ط').slice(0, 1)}
                        </div>
                        <div>
                          <span>{student.user?.name || 'طالب بدون اسم'}</span>
                          <span className="block text-xs text-fg-muted font-mono" dir="ltr">
                            {student.user?.email || '—'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-fg-muted">{student.grade_level || '—'}</td>
                    <td className="py-4 px-3 font-semibold font-mono">
                      <span className={(student.analytics?.attendance_rate ?? 0) >= 85 ? 'text-success' : 'text-danger'}>
                        {formatPercent(student.analytics?.attendance_rate)}
                      </span>
                    </td>
                    <td className="py-4 px-3 font-semibold font-mono">
                      <span className={(student.analytics?.overall_score ?? 0) >= 80 ? 'text-primary' : 'text-warning'}>
                        {formatPercent(student.analytics?.overall_score)}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      {student.status === 'active' ? (
                        <Badge variant="success">منتظم</Badge>
                      ) : (
                        <Badge variant="danger">معلق</Badge>
                      )}
                    </td>
                    <td className="py-4 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/teacher/students/${student.id}`}
                          className="px-3 py-1.5 rounded-sm bg-primary hover:bg-primary-hover text-primary-fg text-xs font-semibold transition-colors shadow-xs"
                        >
                          الملف الشامل
                        </Link>
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="px-2.5 py-1.5 rounded-sm border border-border bg-surface hover:bg-surface-raised text-fg-muted text-xs font-medium transition-colors"
                        >
                          معاينة سريعة
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Student Profile Quick Drawer */}
      <Drawer
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent?.user?.name || selectedStudent?.student_code || ''}
        subtitle={selectedStudent ? `${selectedStudent.student_code} • ${selectedStudent.grade_level || 'غير محدد'}` : ''}
        width="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-fg-muted font-mono">
              معرّف السجل: {selectedStudent?.id.slice(0, 12)}...
            </span>
            <button
              onClick={() => setSelectedStudent(null)}
              className="px-4 py-2 rounded-md bg-surface border border-border hover:bg-surface-raised text-fg text-xs font-semibold"
            >
              إغلاق
            </button>
          </div>
        }
      >
        {selectedStudent && (
          <div className="space-y-6 text-start">
            {/* Quick KPI Strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-md bg-surface-raised border border-border text-center">
                <span className="text-xs text-fg-muted block">نسبة الحضور</span>
                <span className="text-xl font-bold text-success font-mono mt-1 block">
                  {formatPercent(selectedStudent.analytics?.attendance_rate)}
                </span>
              </div>
              <div className="p-3.5 rounded-md bg-surface-raised border border-border text-center">
                <span className="text-xs text-fg-muted block">المعدل العام</span>
                <span className="text-xl font-bold text-primary font-mono mt-1 block">
                  {formatPercent(selectedStudent.analytics?.overall_score)}
                </span>
              </div>
              <div className="p-3.5 rounded-md bg-surface-raised border border-border text-center">
                <span className="text-xs text-fg-muted block">تسليم الواجبات</span>
                <span className="text-xl font-bold text-info font-mono mt-1 block">
                  {formatPercent(selectedStudent.analytics?.assignment_completion_rate)}
                </span>
              </div>
            </div>

            {/* Contact Card */}
            <div className="p-4 rounded-md bg-surface-raised border border-border space-y-2">
              <span className="text-xs font-bold text-fg block mb-2">بيانات التواصل المعتمدة:</span>
              <div className="flex justify-between text-xs py-1 border-b border-border">
                <span className="text-fg-muted">البريد الإلكتروني:</span>
                <span className="text-fg font-mono" dir="ltr">{selectedStudent.user?.email || 'غير متوفر'}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-border">
                <span className="text-fg-muted">رقم الجوال:</span>
                <span className="text-fg font-mono" dir="ltr">{selectedStudent.user?.phone || 'غير متوفر'}</span>
              </div>
            </div>

            {/* Action Shortcuts */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Link
                href={`/teacher/students/${selectedStudent.id}`}
                className="flex-1 text-center py-2.5 rounded-md bg-primary text-primary-fg hover:bg-primary-hover text-xs font-semibold shadow-xs transition-colors"
              >
                
 فتح الملف الأكاديمي الشامل <IconNext size={16} />
 </Link>
              <Link
                href="/teacher/credentials"
                className="flex-1 text-center py-2.5 rounded-md bg-surface border border-border hover:bg-surface-raised text-fg text-xs font-semibold transition-colors"
              >
                إدارة أجهزة الطالب
              </Link>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

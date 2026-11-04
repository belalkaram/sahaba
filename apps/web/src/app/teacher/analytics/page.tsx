'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { analyticsApi } from '../../../lib/analytics-api';
import { educationApi } from '../../../lib/education-api';
import type { Student, StudentAnalyticsSnapshot } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';

import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import { AwardIcon, CheckCircleIcon, RefreshCwIcon, UserIcon } from '../../../components/icons';

import { ChartColumn, Star } from 'lucide-react';
import { formatDate, formatPercent } from '../../../lib/format';
import { AtRiskCard } from '../../../features/analytics/at-risk-card';
export default function TeacherAnalyticsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<StudentAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Load tenant students list
  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        const data = await educationApi.getStudents();
        setStudents(data);
        if (data.length > 0) {
          setSelectedStudentId(data[0].id);
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    };
    loadStudents();
  }, []);

  // 2. Load snapshot whenever selected student changes
  useEffect(() => {
    if (!selectedStudentId) return;

    const loadSnapshot = async () => {
      try {
        setLoadingSnapshot(true);
        const data = await analyticsApi.getStudentDashboard(selectedStudentId);
        setSnapshot(data);
      } catch {
        setSnapshot(null);
      } finally {
        setLoadingSnapshot(false);
      }
    };

    loadSnapshot();
  }, [selectedStudentId]);

  const handleRefresh = async () => {
    if (!selectedStudentId) return;
    try {
      setIsRefreshing(true);
      const data = await analyticsApi.refreshStudentDashboard(selectedStudentId);
      setSnapshot(data);
    } catch {
      // Non-blocking
    } finally {
      setIsRefreshing(false);
    }
  };

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.user?.name?.toLowerCase().includes(q) ||
        s.student_code?.toLowerCase().includes(q) ||
        s.user?.phone?.includes(q)
    );
  }, [students, searchQuery]);

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <PageHeader
        title="التحليلات ومؤشرات الأداء الأكاديمي"
        subtitle="نماذج القراءة السريعة (Fast Read Model Snapshots) وتحليل مؤشرات النجاح ونسب المخاطر للطلبة."
        actions={
          selectedStudentId ? (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loadingSnapshot}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-fg font-medium px-4 py-2 rounded-md text-xs transition-colors shadow-xs"
            >
              <RefreshCwIcon size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'جارٍ إعادة الحساب...' : 'إعادة احتساب المؤشرات (Recompute)'}</span>
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="py-16 text-center text-fg-muted text-sm">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>جارٍ تحميل بيانات الطلاب والتحليلات...</p>
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={<ChartColumn size={20} strokeWidth={1.75} aria-hidden />}
          title="لا يوجد طلاب مسجلون حالياً"
          description="لم يتم العثور على أي طلاب مقيدين في الأكاديمية لحساب مؤشرات الأداء."
        />
      ) : (
        <div className="space-y-6">
          {/* Student Selector Card */}
          <Card className="p-4 bg-surface border border-border shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-primary-subtle text-primary flex items-center justify-center shrink-0">
                  <UserIcon size={20} />
                </div>
                <div>
                  <span className="text-xs text-fg-muted block">الطالب المحدد للتحليل:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-sm text-fg">
                      {selectedStudent?.user?.name || selectedStudent?.student_code || 'طالب'}
                    </span>
                    {selectedStudent?.student_code && (
                      <span className="font-mono text-xs text-primary px-2 py-0.5 rounded-xs bg-primary-subtle border border-primary/20">
                        {selectedStudent.student_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Selector Dropdown & Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="بحث باسم الطالب أو الكود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 rounded-md border border-border bg-surface-sunken text-fg text-xs focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-56"
                />
                <select
                  aria-label="اختر الطالب"
              value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full max-w-full min-w-0 sm:w-auto px-3 py-1.5 rounded-md border border-border bg-surface text-fg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user?.name || s.student_code} ({s.student_code || s.grade_level || 'طالب'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {loadingSnapshot ? (
            <div className="py-12 text-center text-fg-muted text-xs">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-2" />
              <p>جارٍ جلب مؤشرات الطالب المحدّث...</p>
            </div>
          ) : !snapshot ? (
            <Card className="p-8 text-center text-xs text-fg-muted bg-surface border border-border">
              لم يتم حساب مؤشرات تحليلية لهذا الطالب بعد. اضغط على زر «إعادة احتساب المؤشرات» لبنائها من البيانات الأولية.
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Main KPI Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 bg-surface border border-border shadow-xs">
                  <p className="text-xs text-fg-muted">معدل الحضور التراكمي</p>
                  <h3 className="text-2xl font-bold text-fg mt-1 font-mono">
                    {formatPercent(snapshot.attendance_rate)}
                  </h3>
                  <span className="text-xs text-success flex items-center gap-1 mt-1">
                    <CheckCircleIcon size={12} /> التزام دراسي
                  </span>
                </Card>

                <Card className="p-5 bg-surface border border-border shadow-xs">
                  <p className="text-xs text-fg-muted">إنجاز التكليفات</p>
                  <h3 className="text-2xl font-bold text-fg mt-1 font-mono">
                    {formatPercent(snapshot.assignment_completion_rate)}
                  </h3>
                  <span className="text-xs text-primary flex items-center gap-1 mt-1">
                    <CheckCircleIcon size={12} /> معدل تسليم الواجبات
                  </span>
                </Card>

                <Card className="p-5 bg-surface border border-border shadow-xs">
                  <p className="text-xs text-fg-muted">متوسط الاختبارات</p>
                  <h3 className="text-2xl font-bold text-fg mt-1 font-mono">
                    {formatPercent(snapshot.exam_average)}
                  </h3>
                  <span className="text-xs text-info flex items-center gap-1 mt-1">
                    <AwardIcon size={12} /> متوسط درجات الامتحانات
                  </span>
                </Card>

                <Card className="p-5 bg-surface border border-primary/30 shadow-xs">
                  <p className="text-xs text-fg-muted">المؤشر الأكاديمي المركب</p>
                  <h3 className="text-2xl font-bold text-primary mt-1 font-mono">
                    {formatPercent(snapshot.overall_score)}
                  </h3>
                  <span className="text-xs text-fg-muted flex items-center gap-1 mt-1">
                    
 <Star size={16} strokeWidth={1.75} aria-hidden /> المؤشر التراكمي العام
 </span>
                </Card>
              </div>

              {/* Student Detailed Breakdown */}
              <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <h2 className="text-sm font-bold text-fg">
                    تقرير الأداء التحليلي للطالب: {selectedStudent?.user?.name || selectedStudent?.student_code}
                  </h2>
                  <span className="text-xs text-fg-muted font-mono">
                    كود: {selectedStudent?.student_code || '---'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-md bg-surface-raised border border-border">
                    <span className="text-fg-muted block mb-1">تاريخ آخر احتساب:</span>
                    <span className="font-mono text-fg text-sm">
                      {snapshot.last_calculated_at
                        ? formatDate(snapshot.last_calculated_at)
                        : 'حديث'}
                    </span>
                  </div>
                  <div className="p-4 rounded-md bg-surface-raised border border-border">
                    <span className="text-fg-muted block mb-1">تصنيف الأداء والمخاطر:</span>
                    <Badge
                      variant={
                        (snapshot.overall_score ?? 0) >= 75
                          ? 'success'
                          : (snapshot.overall_score ?? 0) >= 50
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {(snapshot.overall_score ?? 0) >= 75
                        ? 'مستوى ممتاز (Low Risk)'
                        : (snapshot.overall_score ?? 0) >= 50
                        ? 'مستوى متوسط (Moderate)'
                        : 'معرض للتعثر (At Risk)'}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-md bg-surface-raised border border-border">
                    <span className="text-fg-muted block mb-1">المستوى الدراسي:</span>
                    <span className="text-fg font-semibold">
                      {selectedStudent?.grade_level || 'غير محدد'}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
      <AtRiskCard />
    </div>
  );
}

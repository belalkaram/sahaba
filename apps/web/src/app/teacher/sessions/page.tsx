'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { attendanceApi } from '../../../lib/attendance-api';
import type { ClassSession } from '../../../types';
import { CalendarIcon, ClockIcon, QrCodeIcon, PlusIcon, SearchIcon } from '../../../components/icons';

import { formatDateTime } from '../../../lib/format';
export default function TeacherSessionsPage() {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await attendanceApi.getSessions();
      setSessions(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'تعذر تحميل قائمة الحصص والجلسات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const filteredSessions = sessions.filter((s) => {
    const matchesStatus =
      statusFilter === 'all' || s.status === statusFilter;

    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.school_class && s.school_class.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarIcon size={24} className="text-primary" />
            جدول الحصص والجلسات الحضورية
          </h1>
          <p className="text-sm text-secondary mt-1">
            تابع مواعيد الجلسات الحضورية، ابدأ الحصص المباشرة، وافتح كشوف الحضور وماسح الـ QR الذكي.
          </p>
        </div>

        <Link
          href="/teacher/classes"
          className="inline-flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-xs transition-opacity shadow-md shadow-primary/20 shrink-0"
        >
          <PlusIcon size={16} />
          إدارة المجموعات وجدولة حصة
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <SearchIcon size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالعنوان أو اسم المجموعة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg ps-9 pe-3 py-2 text-xs text-foreground placeholder:text-secondary/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <div tabIndex={0} className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: 'all', label: 'الكل' },
              { key: 'in_progress', label: 'جارية الآن' },
              { key: 'scheduled', label: 'مجدولة' },
              { key: 'completed', label: 'منتهية' },
              { key: 'cancelled', label: 'ملغاة' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-[12px] text-xs font-medium transition-all ${
                statusFilter === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-secondary hover:text-foreground hover:bg-background'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center text-secondary text-sm">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>جارٍ تحميل جدول الحصص...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredSessions.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-3">
          <CalendarIcon size={40} className="mx-auto text-secondary/40" />
          <h3 className="text-base font-bold text-foreground">لا توجد حصص مجدولة</h3>
          <p className="text-xs text-secondary">
            {searchQuery || statusFilter !== 'all'
              ? 'لا توجد جلسات تطابق معايير البحث.'
              : 'يمكنك جدولة حصص جديدة من داخل أي مجموعة دراسية.'}
          </p>
          <Link
            href="/teacher/classes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
          >
            الانتقال للمجموعات الدراسية
          </Link>
        </div>
      )}

      {/* Sessions Grid */}
      {!loading && !error && filteredSessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSessions.map((sess) => {
            const isLive = sess.status === 'in_progress';
            const isDone = sess.status === 'completed';

            return (
              <div
                key={sess.id}
                className="flex flex-col justify-between rounded-2xl bg-card border border-border p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group"
              >
                <div className="space-y-3">
                  {/* Status & Classroom Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        isLive
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : isDone
                          ? 'bg-surface-muted/10 text-fg-muted border border-border-strong/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                    >
                      {isLive ? 'جارية الآن' : isDone ? 'منتهية' : 'مجدولة'}
                    </span>

                    {sess.classroom && (
                      <span className="text-xs text-secondary font-medium">
                        قاعة: {sess.classroom.name}
                      </span>
                    )}
                  </div>

                  {/* Title & Class */}
                  <div>
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {sess.title}
                    </h3>
                    {sess.school_class && (
                      <span className="text-xs text-secondary font-medium block mt-1">
                        المجموعة: <strong className="text-foreground">{sess.school_class.name}</strong>
                      </span>
                    )}
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-1.5 text-xs text-secondary pt-1 border-t border-border/60">
                    <ClockIcon size={14} className="text-secondary/60" />
                    <span>
                      {sess.starts_at ? formatDateTime(sess.starts_at) : '---'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-2">
                  <Link
                    href={`/staff/sessions/${sess.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground font-semibold px-3 py-2 rounded-lg text-xs transition-opacity shadow-sm"
                  >
                    كشف الحضور
                  </Link>

                  {sess.attendance_mode !== 'manual' && !isDone && (
                    <Link
                      href={`/teacher/attendance/scan/${sess.id}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-secondary hover:text-foreground hover:bg-background text-xs font-semibold transition-colors"
                      title="فتح ماسح الكاميرا"
                    >
                      <QrCodeIcon size={14} />
                      الماسح
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

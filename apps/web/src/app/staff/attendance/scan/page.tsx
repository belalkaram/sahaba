'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { attendanceApi } from '../../../../lib/attendance-api';
import type { ClassSession } from '../../../../types';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { PageHeader } from '../../../../components/ui/page-header';
import { EmptyState } from '../../../../components/ui/empty-state';
import { formatTime } from '../../../../lib/format';
import { QrCode, Calendar, Clock, MapPin, ArrowRight, Play, CheckCircle2 } from 'lucide-react';

export default function StaffAttendanceScanIndexPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTodaySessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await attendanceApi.getMyTodaySessions();
      setSessions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل حصص اليوم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodaySessions();
  }, []);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.status === 'in_progress') || sessions.find((s) => s.status === 'scheduled');
  }, [sessions]);

  return (
    <div className="space-y-6 text-start max-w-4xl mx-auto">
      <PageHeader
        title="تسجيل الحضور بالكاميرا (QR)"
        description="اختر الحصة الجارية لمسح بطاقات الطلاب وتسجيل الحضور المباشر بكاميرا الجوال."
        breadcrumbs={[
          { label: 'الرئيسية', href: '/teacher/dashboard' },
          { label: 'الحصص والحضور', href: '/teacher/attendance' },
          { label: 'مسح الحضور' },
        ]}
      />

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
          {error}
        </div>
      )}

      {/* Quick Launch Active Session */}
      {activeSession && (
        <Card className="p-5 border-primary/40 bg-primary/5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={activeSession.status === 'in_progress' ? 'success' : 'brand'}>
                  {activeSession.status === 'in_progress' ? 'حصة جارية الآن' : 'الحصة التالية'}
                </Badge>
                <span className="text-xs text-fg-muted font-mono">
                  {formatTime(activeSession.starts_at)}
                </span>
              </div>
              <h3 className="text-lg font-bold text-fg">{activeSession.title}</h3>
              <p className="text-sm text-fg-muted">
                {activeSession.schoolClass?.name || 'فصل غير محدد'}
                {activeSession.classroom?.name ? ` — ${activeSession.classroom.name}` : ''}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="gap-2"
              onClick={() => router.push(`/staff/attendance/scan/${activeSession.id}`)}
            >
              <QrCode size={20} />
              <span>فتح كاميرا المسح فوراً</span>
            </Button>
          </div>
        </Card>
      )}

      {/* All Today's Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-fg flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            <span>حصص اليوم</span>
          </h2>
          <Button variant="ghost" size="sm" onClick={loadTodaySessions} disabled={loading}>
            تحديث القائمة
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-fg-muted text-sm">جاري جلب حصص اليوم...</div>
        ) : sessions.length === 0 ? (
          <EmptyState
            title="لا توجد حصص مجدولة لليوم"
            description="لم يتم العثور على أي جلسات أو حصص دراسية مخصصة لك في تاريخ اليوم."
            icon={<Calendar size={24} />}
            action={{
              label: 'استعراض كل الحصص والجلسات',
              onClick: () => router.push('/teacher/attendance'),
            }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((sess) => {
              const isCurrent = sess.status === 'in_progress';
              const isDone = sess.status === 'completed';

              return (
                <Card
                  key={sess.id}
                  className="p-4 hover:border-primary/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          isCurrent ? 'success' : isDone ? 'neutral' : 'warning'
                        }
                      >
                        {isCurrent ? 'جارية' : isDone ? 'منتهية' : 'مجدولة'}
                      </Badge>
                      <span className="text-xs font-mono text-fg-muted flex items-center gap-1">
                        <Clock size={12} />
                        {formatTime(sess.starts_at)}
                      </span>
                    </div>

                    <h4 className="font-bold text-fg text-sm line-clamp-1">{sess.title}</h4>

                    <div className="text-xs text-fg-muted space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-fg-muted">الشعبة:</span>
                        <span>{sess.schoolClass?.name || 'عام'}</span>
                      </div>
                      {sess.classroom?.name && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} />
                          <span>{sess.classroom.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-fg-muted">
                      {isDone ? 'تم رصد الحضور' : 'جاهزة للمسح'}
                    </span>
                    <Button
                      variant={isCurrent ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => router.push(`/staff/attendance/scan/${sess.id}`)}
                      className="gap-1.5 text-xs"
                    >
                      <QrCode size={14} />
                      <span>{isDone ? 'عرض السجل' : 'مسح الحضور'}</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

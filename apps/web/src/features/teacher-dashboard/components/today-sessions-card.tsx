'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { CalendarIcon, QrCodeIcon } from '../../../components/icons';

export interface SessionScheduleItem {
  id: string;
  className: string;
  courseTitle: string;
  time: string;
  room: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  enrolledCount: number;
}

export interface TodaySessionsCardProps {
  sessions: SessionScheduleItem[];
}

export const TodaySessionsCard: React.FC<TodaySessionsCardProps> = ({ sessions }) => {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-fg">الحصص والجلسات القادمة</h3>
        </div>
        <Link href="/teacher/attendance" className="text-xs text-primary hover:underline font-semibold">
          عرض الجدول
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-xs text-fg-muted">
          لا توجد حصص مجدولة لليوم.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="flex items-center justify-between p-3.5 rounded-md border border-border bg-surface-sunken hover:bg-surface-raised transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-fg">{sess.className}</span>
                  <Badge variant={sess.status === 'in_progress' ? 'success' : 'neutral'}>
                    {sess.status === 'in_progress' ? 'جارية الآن' : 'مجدولة'}
                  </Badge>
                </div>
                <div className="text-xs text-fg-muted">
                  {sess.courseTitle} • {sess.time}
                </div>
              </div>

              <Link
                href={`/teacher/attendance/scan/${sess.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shrink-0"
              >
                <QrCodeIcon size={14} />
                <span>مسح الحضور</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};


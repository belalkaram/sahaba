'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/card';
import { ClockIcon, AlertCircleIcon } from '../../../components/icons';

export interface DeadlineItem {
  id: string;
  title: string;
  courseTitle: string;
  type: 'assignment' | 'exam';
  dueText: string;
  dueHoursRemaining: number;
  link: string;
}

export interface UpcomingDeadlinesWidgetProps {
  deadlines: DeadlineItem[];
}

export const UpcomingDeadlinesWidget: React.FC<UpcomingDeadlinesWidgetProps> = ({ deadlines }) => {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ClockIcon size={18} className="text-warning" />
          <h3 className="text-sm font-bold text-fg">الواجبات والتكليفات القريبة</h3>
        </div>
        <Link href="/student/assignments" className="text-xs text-primary hover:underline font-semibold">
          عرض الكل
        </Link>
      </div>

      {deadlines.length === 0 ? (
        <div className="text-center py-6 text-xs text-fg-muted">
          
 لا توجد مواعيد تسليم ملحة حالياً 
 </div>
      ) : (
        <div className="space-y-2.5">
          {deadlines.map((item) => (
            <Link
              key={item.id}
              href={item.link}
              className="flex items-center justify-between p-3 rounded-md border border-border bg-surface-sunken hover:bg-surface-raised transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-fg truncate">{item.title}</p>
                <p className="text-xs text-fg-muted mt-0.5">{item.courseTitle}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xs bg-warning-subtle text-warning-subtle-fg text-xs font-semibold">
                <AlertCircleIcon size={12} />
                <span>{item.dueText}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
};


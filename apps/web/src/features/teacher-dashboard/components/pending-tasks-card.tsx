'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/card';
import { AlertCircleIcon } from '../../../components/icons';

export interface PendingTaskItem {
  id: string;
  title: string;
  type: 'payment' | 'grading' | 'credential';
  count: number;
  link: string;
  urgency: 'high' | 'medium' | 'normal';
}

export interface PendingTasksCardProps {
  tasks: PendingTaskItem[];
}

export const PendingTasksCard: React.FC<PendingTasksCardProps> = ({ tasks }) => {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertCircleIcon size={18} className="text-warning" />
          <h3 className="text-sm font-bold text-fg">مهام تتطلب تدخلك</h3>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={task.link}
            className="flex items-center justify-between p-3.5 rounded-md border border-border bg-surface-sunken hover:bg-surface-raised transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-fg truncate">{task.title}</p>
              <p className="text-xs text-fg-muted mt-0.5">
                {task.count > 0 ? `${task.count} عنصر قيد الانتظار` : 'محدثة بالكامل'}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold shrink-0 ${
                task.count > 0
                  ? 'bg-warning-subtle text-warning-subtle-fg'
                  : 'bg-surface-raised text-fg-subtle'
              }`}
            >
              {task.count}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
};


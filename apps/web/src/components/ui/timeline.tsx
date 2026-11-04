'use client';

import React from 'react';

import { Check } from 'lucide-react';
export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  time?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  status?: 'completed' | 'current' | 'pending' | 'danger';
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = '' }) => {
  return (
    <div className={`relative ps-6 space-y-6 ${className}`}>
      {/* Vertical line */}
      <div className="absolute right-2.5 top-2 bottom-2 w-0.5 bg-border -translate-x-1/2" />

      {items.map((item) => {
        const statusColors = {
          completed: 'bg-success text-success-fg border-success',
          current: 'bg-primary text-primary-fg border-primary ring-4 ring-primary-subtle',
          pending: 'bg-surface text-fg-subtle border-border-strong',
          danger: 'bg-danger text-danger-fg border-danger',
        }[item.status || 'completed'];

        return (
          <div key={item.id} className="relative flex items-start gap-4">
            {/* Dot / Icon */}
            <div
              className={`absolute -start-6 flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs font-bold z-10 ${statusColors}`}
            >
              {item.icon || (item.status === 'completed' ? <Check size={16} strokeWidth={1.75} aria-hidden /> : '')}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 ps-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-fg">{item.title}</h4>
                {item.time && <span className="text-xs text-fg-subtle shrink-0 font-mono">{item.time}</span>}
              </div>
              {item.description && (
                <div className="text-xs text-fg-muted mt-1 leading-relaxed">{item.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};


'use client';

import React from 'react';

export interface CalendarEvent {
  id: string;
  dayIndex: number; // 0 = Sunday, 6 = Saturday
  title: string;
  time: string;
  category?: 'live' | 'exam' | 'assignment' | 'attendance';
}

export interface CalendarWeekProps {
  events: CalendarEvent[];
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
  className?: string;
}

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const CalendarWeek: React.FC<CalendarWeekProps> = ({
  events,
  selectedDate = new Date(),
  onSelectDate,
  className = '',
}) => {
  const currentDayIndex = selectedDate.getDay();

  return (
    <div className={`w-full rounded-md border border-border bg-surface overflow-hidden ${className}`}>
      <div className="grid grid-cols-7 border-b border-border bg-surface-sunken text-center">
        {DAYS_AR.map((dayName, idx) => {
          const isToday = idx === currentDayIndex;
          return (
            <div
              key={dayName}
              onClick={() => {
                const newD = new Date(selectedDate);
                const diff = idx - currentDayIndex;
                newD.setDate(newD.getDate() + diff);
                onSelectDate?.(newD);
              }}
              className={`p-2 sm:p-3 cursor-pointer transition-colors ${
                isToday ? 'bg-primary-subtle text-primary font-bold' : 'hover:bg-surface-raised text-fg-muted'
              }`}
            >
              <div className="text-xs sm:text-xs">{dayName}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 min-h-[160px] divide-x divide-x-reverse divide-border">
        {DAYS_AR.map((_, dayIdx) => {
          const dayEvents = events.filter((e) => e.dayIndex === dayIdx);
          const isToday = dayIdx === currentDayIndex;

          return (
            <div
              key={dayIdx}
              className={`p-1.5 sm:p-2 space-y-1.5 ${isToday ? 'bg-primary-subtle/10' : ''}`}
            >
              {dayEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-xs border border-border bg-surface p-1.5 shadow-xs text-start text-xs sm:text-xs"
                >
                  <span className="font-semibold text-fg block truncate">{evt.title}</span>
                  <span className="text-fg-subtle text-xs block font-mono">{evt.time}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};


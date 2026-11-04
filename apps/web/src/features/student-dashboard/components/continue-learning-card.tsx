'use client';

import React from 'react';
import Link from 'next/link';
import { PlayIcon } from '../../../components/icons';
import { ProgressBar } from '../../../components/ui/progress-bar';

import { formatPercent } from '../../../lib/format';
export interface ContinueLearningData {
  courseTitle: string;
  courseCode?: string;
  lessonTitle: string;
  lessonDuration: string;
  progressPercentage: number;
  lastWatchedTime: string;
}

export interface ContinueLearningCardProps {
  data: ContinueLearningData | null;
}

export const ContinueLearningCard: React.FC<ContinueLearningCardProps> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-surface p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-primary-subtle text-primary text-xs font-bold border border-primary/20">
              <PlayIcon size={12} className="text-primary" />
              متابعة التعلم
            </span>
            {data.courseCode && (
              <span className="text-xs text-fg-muted font-mono">{data.courseCode}</span>
            )}
          </div>

          <h3 className="text-lg font-bold text-fg mt-2">{data.lessonTitle}</h3>
          <p className="text-xs text-fg-muted">
            مقرر: <strong className="font-semibold text-fg">{data.courseTitle}</strong> • المدة: {data.lessonDuration}
          </p>

          <div className="pt-3 max-w-md">
            <div className="flex justify-between text-xs text-fg-muted mb-1">
              <span>اكتمل {formatPercent(data.progressPercentage)} من الدرس</span>
              <span>{data.lastWatchedTime}</span>
            </div>
            <ProgressBar value={data.progressPercentage} variant="primary" size="sm" />
          </div>
        </div>

        <div className="shrink-0">
          <Link href="/student/courses">
            <button className="flex items-center gap-2 rounded-md bg-primary text-primary-fg px-6 py-3 font-semibold text-xs hover:bg-primary-hover transition-colors">
              <PlayIcon size={16} />
              استئناف المشاهدة الآن
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};


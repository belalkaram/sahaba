'use client';

/**
 * R7A — Shared Detail Page Layout Pattern
 * Consistent layout for resource detail views (Course, Exam, Student, Assignment, Tenant, etc.).
 * Includes:
 *   - Breadcrumbs & entity header (identity, title, status badges, primary action buttons)
 *   - Optional tabs navigation
 *   - 2-column layout (main content + side summary card on desktop)
 */

import React from 'react';
import { Breadcrumbs, BreadcrumbItem } from '../ui/breadcrumbs';

export interface DetailTab {
  id: string;
  label: string;
  count?: number;
  badge?: React.ReactNode;
}

export interface DetailLayoutProps {
  breadcrumbs?: BreadcrumbItem[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  avatar?: React.ReactNode;
  statusBadge?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: DetailTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  sideSummary?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const DetailLayout: React.FC<DetailLayoutProps> = ({
  breadcrumbs,
  title,
  subtitle,
  avatar,
  statusBadge,
  actions,
  tabs,
  activeTab,
  onTabChange,
  sideSummary,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-6 text-start ${className}`}>
      {/* 1. Header Section */}
      <div className="rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-xs space-y-4">
        {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            {avatar && <div className="shrink-0">{avatar}</div>}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-fg tracking-tight truncate">
                  {title}
                </h1>
                {statusBadge && <div className="shrink-0">{statusBadge}</div>}
              </div>
              {subtitle && (
                <div className="text-xs sm:text-sm text-fg-muted max-w-2xl leading-relaxed">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {actions && <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">{actions}</div>}
        </div>

        {/* 2. Tabs Bar */}
        {tabs && tabs.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border pt-3 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-fg shadow-xs'
                      : 'text-fg-muted hover:bg-surface-raised hover:text-fg'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        isActive ? 'bg-primary-fg/20 text-primary-fg' : 'bg-surface-raised text-fg-muted'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {tab.badge}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Main Body: 2-Column Grid with Side Summary on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={sideSummary ? 'lg:col-span-2 space-y-6' : 'lg:col-span-3 space-y-6'}>
          {children}
        </div>

        {sideSummary && (
          <div className="lg:col-span-1">
            <div className="sticky top-20 rounded-lg border border-border bg-surface p-5 shadow-xs space-y-4">
              {sideSummary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


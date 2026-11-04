'use client';

import React from 'react';
import { Breadcrumbs, BreadcrumbItem } from './breadcrumbs';
import { cn } from '../../lib/cn';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** @deprecated use description */
  subtitle?: React.ReactNode;
  /** Small label above the title (e.g. section or role). */
  eyebrow?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * One header pattern for every page: breadcrumbs → eyebrow → display title (Arabic display face)
 * with the sand accent → description, and the primary actions at the inline end.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  subtitle,
  eyebrow,
  breadcrumbs,
  badge,
  actions,
  className = '',
}) => {
  const desc = description ?? subtitle;
  return (
    <header className={cn('space-y-3 pb-2', className)} data-page-header>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow && <p className="text-xs font-semibold text-primary">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="heading-accent font-display text-2xl text-fg sm:text-3xl">{title}</h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {desc && <p className="max-w-2xl text-sm text-fg-muted sm:text-base">{desc}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};

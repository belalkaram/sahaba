'use client';

import React from 'react';
import Link from 'next/link';
import { IconChevronNext } from '../icons/directional';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  return (
    <nav aria-label="مسار التنقل" className={`flex items-center gap-1.5 text-sm text-fg-muted ${className}`}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        return (
          <React.Fragment key={idx}>
            {idx > 0 && <IconChevronNext size={14} className="shrink-0 text-fg-subtle" />}
            {isLast || !item.href ? (
              <span className="font-semibold text-fg truncate" aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-primary transition-colors truncate">
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};


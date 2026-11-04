'use client';

import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className = '',
}) => {
  if (totalPages <= 1 && !totalItems) return null;

  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('ellipsis');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  const startItem = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endItem = totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-fg-muted ${className}`}
    >
      {totalItems !== undefined && startItem && endItem && (
        <div>
          عرض <strong className="text-fg">{startItem}</strong> إلى{' '}
          <strong className="text-fg">{endItem}</strong> من أصل{' '}
          <strong className="text-fg">{totalItems}</strong> عنصر
        </div>
      )}

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-xs border border-border px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-surface-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          السابق
        </button>

        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-fg-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                currentPage === p
                  ? 'bg-primary text-primary-fg'
                  : 'border border-border text-fg hover:bg-surface-raised'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-xs border border-border px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-surface-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          التالي
        </button>
      </div>
    </div>
  );
};


'use client';

import React, { useState, useMemo } from 'react';
import { Checkbox } from './checkbox';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'right' | 'center' | 'left';
  width?: string;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T | ((row: T) => string);
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  stickyHeader?: boolean;
  className?: string;
  renderMobileCard?: (row: T, index: number) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  isLoading = false,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription = 'لم يتم العثور على أي عناصر لعرضها',
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  stickyHeader = true,
  className = '',
  renderMobileCard,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const getRowId = (row: T): string => {
    if (typeof keyField === 'function') return keyField(row);
    return String(row[keyField]);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      return sortDir === 'asc' ? 1 : -1;
    });
  }, [data, sortKey, sortDir]);

  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(getRowId(row)));
  const isIndeterminate = selectedIds.length > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(data.map(getRowId));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange?.(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange?.([...selectedIds, id]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4 bg-surface rounded-md border border-border">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-8">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden rounded-md border border-border bg-surface shadow-xs ${className}`}>
      {/* Mobile Card View (shown only on small screens if renderMobileCard provided) */}
      {renderMobileCard && (
        <div className="md:hidden divide-y divide-border">
          {sortedData.map((row, idx) => (
            <div key={getRowId(row)} className="p-4">
              {renderMobileCard(row, idx)}
            </div>
          ))}
        </div>
      )}

      {/* Desktop / Standard Table */}
      <div className={`overflow-x-auto ${renderMobileCard ? 'hidden md:block' : ''}`}>
        <table className="w-full text-start border-collapse text-xs">
          <thead className={`border-b border-border bg-surface-sunken text-fg-muted uppercase tracking-wider font-semibold ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={isIndeterminate}
                    onChange={toggleSelectAll}
                    aria-label="تحديد الكل"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-4 py-3 text-${col.align || 'right'} ${
                    col.sortable ? 'cursor-pointer select-none hover:text-fg' : ''
                  } ${col.hideOnMobile ? 'hidden lg:table-cell' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className={`flex items-center gap-1.5 justify-${col.align === 'center' ? 'center' : col.align === 'left' ? 'end' : 'start'}`}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-xs text-fg-subtle">
                        {sortKey === col.key ? (sortDir === 'asc' ? <ChevronUp size={16} strokeWidth={1.75} aria-hidden /> : <ChevronDown size={16} strokeWidth={1.75} aria-hidden />) : <ArrowUpDown size={16} strokeWidth={1.75} aria-hidden />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {sortedData.map((row, index) => {
              const rowId = getRowId(row);
              const isSelected = selectedIds.includes(rowId);

              return (
                <tr
                  key={rowId}
                  className={`transition-colors hover:bg-surface-raised ${
                    isSelected ? 'bg-primary-subtle/30' : ''
                  }`}
                >
                  {selectable && (
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelectRow(rowId)}
                        aria-label={`تحديد الصف ${index + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-${col.align || 'right'} text-fg ${
                        col.hideOnMobile ? 'hidden lg:table-cell' : ''
                      }`}
                    >
                      {col.render ? col.render(row, index) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


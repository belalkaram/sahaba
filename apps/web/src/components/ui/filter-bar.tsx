'use client';

import React from 'react';
import { SearchInput } from './search-input';

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'بحث...',
  children,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 ${className}`}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {onSearchChange && (
          <div className="w-full sm:w-64">
            <SearchInput
              value={searchValue || ''}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
          </div>
        )}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};


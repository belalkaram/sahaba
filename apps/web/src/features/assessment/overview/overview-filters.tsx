'use client';

import React from 'react';
import { FilterBar } from '../../../components/ui/filter-bar';
import { Input } from '../../../components/ui/input';
import { Select, type SelectOption } from '../../../components/ui/select';
import { EMPTY_FILTERS, type CourseOption, type OverviewFilterValues } from '../../../lib/assessment-overview-api';

interface OverviewFiltersProps {
  value: OverviewFilterValues;
  onChange: (next: OverviewFilterValues) => void;
  courses: CourseOption[];
  statusOptions: SelectOption[];
  needsOptions: SelectOption[];
  sortOptions: SelectOption[];
  /** What the date range is applied to, in words. */
  dateHint: string;
  searchPlaceholder: string;
}

export function OverviewFilters({ value, onChange, courses, statusOptions, needsOptions, sortOptions, dateHint, searchPlaceholder }: OverviewFiltersProps) {
  const set = (patch: Partial<OverviewFilterValues>) => onChange({ ...value, ...patch });
  const isFiltered = Object.values(value).some(Boolean);
  const selectBox = 'w-full sm:w-44';
  const dateBox = 'w-full sm:w-48';

  return (
    <FilterBar
      searchValue={value.search}
      onSearchChange={(search) => set({ search })}
      searchPlaceholder={searchPlaceholder}
      actions={
        isFiltered ? (
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">
            مسح الفلاتر
          </button>
        ) : undefined
      }
    >
      <div className={selectBox}>
        <Select
          aria-label="تصفية حسب المقرر"
          value={value.course_id}
          onChange={(e) => set({ course_id: e.target.value })}
          options={[{ value: '', label: 'كل المقررات' }, ...courses.map((c) => ({ value: c.id, label: `${c.title} (${c.code})` }))]}
        />
      </div>
      <div className={selectBox}>
        <Select aria-label="تصفية حسب الحالة" value={value.status} onChange={(e) => set({ status: e.target.value })} options={[{ value: '', label: 'كل الحالات' }, ...statusOptions]} />
      </div>
      <div className={selectBox}>
        <Select aria-label="تصفية حسب ما يحتاج متابعة" value={value.needs} onChange={(e) => set({ needs: e.target.value })} options={[{ value: '', label: 'يحتاج متابعة: الكل' }, ...needsOptions]} />
      </div>
      <div className={selectBox}>
        <Select aria-label="ترتيب النتائج" value={value.sort} onChange={(e) => set({ sort: e.target.value })} options={sortOptions} />
      </div>
      <label className={`${dateBox} flex items-center gap-2 text-xs text-fg-muted`} title={dateHint}>
        <span className="shrink-0">من</span>
        <Input type="date" aria-label={`من تاريخ (${dateHint})`} value={value.date_from} max={value.date_to || undefined} onChange={(e) => set({ date_from: e.target.value })} />
      </label>
      <label className={`${dateBox} flex items-center gap-2 text-xs text-fg-muted`} title={dateHint}>
        <span className="shrink-0">إلى</span>
        <Input type="date" aria-label={`إلى تاريخ (${dateHint})`} value={value.date_to} min={value.date_from || undefined} onChange={(e) => set({ date_to: e.target.value })} />
      </label>
    </FilterBar>
  );
}

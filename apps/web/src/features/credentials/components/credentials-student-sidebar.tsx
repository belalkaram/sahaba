'use client';

import React from 'react';
import type { Student } from '../../../types';
import { Card } from '../../../components/ui/card';
import { SearchInput } from '../../../components/ui/search-input';
import { Skeleton } from '../../../components/ui/skeleton';
import { Avatar } from '../../../components/ui/avatar';

import { formatNumber } from '../../../lib/format';
export interface CredentialsStudentSidebarProps {
  students: Student[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  loading: boolean;
}

export const CredentialsStudentSidebar: React.FC<CredentialsStudentSidebarProps> = ({
  students,
  selectedStudentId,
  onSelectStudent,
  search,
  onSearchChange,
  loading,
}) => {
  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = s.user?.name?.toLowerCase() || '';
    const code = s.student_code?.toLowerCase() || '';
    const phone = s.user?.phone?.toLowerCase() || '';
    return name.includes(q) || code.includes(q) || phone.includes(q);
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-fg">اختر الطالب لعرض أجهزته</h3>
        <span className="text-xs text-fg-muted font-mono">{formatNumber(students.length)} طالب</span>
      </div>

      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="بحث باسم أو كود الطالب..."
      />

      <div className="max-h-[500px] overflow-y-auto space-y-1.5 divide-y divide-border">
        {loading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-fg-muted text-center py-6">لم يتم العثور على أي طالب</p>
        ) : (
          filtered.map((s) => {
            const isSelected = s.id === selectedStudentId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectStudent(s.id)}
                className={`w-full text-right p-2.5 rounded-lg transition-colors flex items-center gap-3 ${
                  isSelected
                    ? 'bg-primary-subtle text-primary border border-primary/30'
                    : 'hover:bg-surface-raised text-fg'
                }`}
              >
                <Avatar name={s.user?.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{s.user?.name || 'طالب مسجل'}</p>
                  <p className="text-xs text-fg-muted font-mono">
                    {s.student_code || s.user?.phone || 'بدون كود'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
};


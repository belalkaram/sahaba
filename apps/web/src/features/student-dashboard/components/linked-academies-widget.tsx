'use client';

import React from 'react';

import { School } from 'lucide-react';
import { formatNumber } from '../../../lib/format';
export interface LinkedAcademy {
  tenant_id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  brand_tagline?: string | null;
  is_current: boolean;
}

export interface LinkedAcademiesWidgetProps {
  academies: LinkedAcademy[];
  onSelectTenant: (slug: string) => void;
}

export const LinkedAcademiesWidget: React.FC<LinkedAcademiesWidgetProps> = ({
  academies,
  onSelectTenant,
}) => {
  if (academies.length === 0) return null;

  return (
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-md bg-surface border border-border shadow-xs"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary-subtle text-primary text-xs font-bold">
          
 <School size={16} strokeWidth={1.75} aria-hidden />
 </span>
        <span className="text-xs font-bold text-fg">
          الأكاديميات المرتبطة بحسابك ({formatNumber(academies.length)}):
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {academies.map((acad) => (
          <button
            key={acad.tenant_id}
            onClick={() => {
              if (!acad.is_current) {
                onSelectTenant(acad.slug);
                window.location.reload();
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              acad.is_current
                ? 'bg-primary text-primary-fg shadow-xs ring-2 ring-primary/30'
                : 'bg-surface-raised text-fg-muted hover:bg-surface hover:text-fg'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: acad.primary_color || 'var(--primary)' }}
            />
            <span>{acad.name}</span>
            {acad.is_current && <span className="text-xs opacity-90 font-mono">(النشطة)</span>}
          </button>
        ))}
      </div>
    </div>
  );
};


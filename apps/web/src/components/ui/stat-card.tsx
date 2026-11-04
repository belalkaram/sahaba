'use client';

import React from 'react';
import { KpiCard, type KpiTone } from './kpi-card';

/**
 * @deprecated Use KpiCard. Kept as a thin adapter so existing pages keep working;
 * the old colored side-border variants map onto semantic tones.
 */
export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  variant?: 'default' | 'emerald' | 'indigo' | 'amber' | 'purple';
  action?: React.ReactNode;
}

const toneMap: Record<NonNullable<StatCardProps['variant']>, KpiTone> = {
  default: 'brand',
  emerald: 'success',
  indigo: 'info',
  amber: 'warning',
  purple: 'accent',
};

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, subtitle, trend, variant = 'default', action }) => (
  <div>
    <KpiCard label={title} value={value} icon={icon} hint={trend ? undefined : subtitle} delta={trend} tone={toneMap[variant]} />
    {action && <div className="mt-2">{action}</div>}
  </div>
);

import React from 'react';
import { cn } from '../../lib/cn';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple' | 'live';

const soft: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-muted text-fg-muted',
  /** Solid primary pill with a glowing dot (live sessions). */
  live: 'bg-primary text-primary-fg',
  brand: 'bg-primary-subtle text-primary-subtle-fg',
  success: 'bg-success-subtle text-success-subtle-fg',
  warning: 'bg-warning-subtle text-warning-subtle-fg',
  danger: 'bg-danger-subtle text-danger-subtle-fg',
  info: 'bg-info-subtle text-info-subtle-fg',
  accent: 'bg-accent-subtle text-accent-subtle-fg',
  /** @deprecated legacy name, rendered as accent */
  purple: 'bg-accent-subtle text-accent-subtle-fg',
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'md', dot, icon, className = '' }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold text-xs',
      size === 'sm' ? 'h-6 px-2.5' : 'h-[30px] px-3',
      soft[variant],
      className,
    )}
  >
    {(dot || variant === 'live') && (
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          variant === 'live' ? 'bg-[var(--live-dot)] shadow-[0_0_8px_var(--live-dot)]' : 'bg-current',
        )}
        aria-hidden
      />
    )}
    {icon}
    {children}
  </span>
);

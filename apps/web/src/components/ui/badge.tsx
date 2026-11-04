import React from 'react';
import { cn } from '../../lib/cn';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple';

const soft: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-muted text-fg-muted border-border',
  brand: 'bg-primary-subtle text-primary-subtle-fg border-primary/20',
  success: 'bg-success-subtle text-success-subtle-fg border-success/20',
  warning: 'bg-warning-subtle text-warning-subtle-fg border-warning/25',
  danger: 'bg-danger-subtle text-danger-subtle-fg border-danger/20',
  info: 'bg-info-subtle text-info-subtle-fg border-info/20',
  accent: 'bg-accent-subtle text-accent-subtle-fg border-accent/25',
  /** @deprecated legacy name, rendered as accent */
  purple: 'bg-accent-subtle text-accent-subtle-fg border-accent/25',
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
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold text-xs',
      size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1',
      soft[variant],
      className,
    )}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
    {icon}
    {children}
  </span>
);

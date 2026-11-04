import React from 'react';
import { cn } from '../../lib/cn';

export type CardVariant = 'default' | 'interactive' | 'muted' | 'brand' | 'outline';

const variants: Record<CardVariant, string> = {
  default: 'bg-surface border border-border shadow-sm',
  interactive:
    'bg-surface border border-border shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong',
  muted: 'bg-surface-muted border border-border-subtle',
  brand: 'relative overflow-hidden bg-gradient-brand text-surface-brand-fg border border-transparent shadow-md',
  outline: 'bg-transparent border border-dashed border-border-strong',
};

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: keyof typeof paddings;
  /** @deprecated kept for compatibility; has no effect */
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  glow: _glow,
  ...props
}) => (
  <div className={cn('rounded-lg', variants[variant], paddings[padding], className)} {...props}>
    {variant === 'brand' ? (
      <>
        <span className="pattern-overlay opacity-70" aria-hidden />
        <div className="relative">{children}</div>
      </>
    ) : (
      children
    )}
  </div>
);

export const CardHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, description, icon, actions, className = '' }) => (
  <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
    <div className="flex min-w-0 items-start gap-3">
      {icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary">{icon}</span>
      )}
      <div className="min-w-0">
        <h3 className="text-base font-bold leading-snug text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

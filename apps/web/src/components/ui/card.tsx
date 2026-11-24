import React from 'react';
import { cn } from '../../lib/cn';

export type CardVariant = 'default' | 'interactive' | 'muted' | 'brand' | 'outline';

const variants: Record<CardVariant, string> = {
  default: 'glass',
  interactive:
    'glass transition-transform duration-200 ease-out hover:-translate-y-0.5',
  muted: 'glass-well',
  brand: 'glass relative overflow-hidden [--surface-brand-fg:var(--fg)]',
  outline: 'bg-transparent border border-[var(--glass-border)]',
};

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-[30px]', lg: 'p-6 sm:p-10' };

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
  <div className={cn(variant === 'muted' ? 'rounded-md' : 'rounded-xl', variants[variant], paddings[padding], className)} {...props}>
    {children}
  </div>
);

export const CardHeader: React.FC<{
  title: React.ReactNode;
  /** Sand section number before the title, e.g. "01". */
  number?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, number, description, icon, actions, className = '' }) => (
  <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
    <div className="flex min-w-0 items-start gap-3">
      {icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-primary-subtle text-primary">{icon}</span>
      )}
      <div className="min-w-0">
        <h3 className="flex items-baseline gap-2 text-[17px] font-bold leading-snug text-fg">
          {number != null && <span className="text-sm font-semibold tabular-nums text-accent">{number}</span>}
          {title}
        </h3>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);

import { cn } from '../../lib/cn';

/** Button class recipes — a plain module so server components can use buttonClasses(). */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'subtle' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none ' +
  'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-60 focus-visible:shadow-[var(--focus-ring)] outline-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'btn-primary hover:brightness-105',
  secondary: 'bg-[var(--glass-bg-strong)] text-fg border border-[var(--glass-border)] shadow-[var(--glass-highlight)] hover:bg-surface-raised',
  outline: 'bg-transparent text-primary border border-primary/45 hover:bg-primary-subtle',
  subtle: 'bg-primary-subtle text-primary-subtle-fg hover:bg-primary/15',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-muted hover:text-fg',
  danger: 'bg-danger-subtle text-danger-subtle-fg border border-danger/20 hover:bg-danger hover:text-danger-fg',
  link: 'bg-transparent text-primary underline-offset-4 hover:underline px-0 h-auto',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-[var(--control-h-sm)] px-4 text-sm rounded-sm',
  md: 'h-[var(--control-h)] px-[22px] text-sm rounded-sm',
  lg: 'h-[var(--control-h-lg)] px-7 text-base rounded-sm',
  icon: 'h-[var(--control-h)] w-[var(--control-h)] rounded-sm',
};

/** Class recipe for links styled as buttons (e.g. next/link). */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return cn(base, variants[variant], variant === 'link' ? '' : sizes[size], className);
}


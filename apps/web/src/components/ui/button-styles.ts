import { cn } from '../../lib/cn';

/** Button class recipes — a plain module so server components can use buttonClasses(). */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'subtle' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none ' +
  'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:shadow-[var(--focus-ring)] outline-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg shadow-xs hover:bg-primary-hover',
  secondary: 'bg-surface text-fg border border-border-strong shadow-xs hover:bg-surface-muted',
  outline: 'bg-transparent text-primary border border-primary/40 hover:bg-primary-subtle',
  subtle: 'bg-primary-subtle text-primary-subtle-fg hover:bg-primary/15',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-muted hover:text-fg',
  danger: 'bg-danger text-danger-fg shadow-xs hover:bg-danger-hover',
  link: 'bg-transparent text-primary underline-offset-4 hover:underline px-0 h-auto',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-sm',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-6 text-base rounded-md',
  icon: 'h-10 w-10 rounded-md',
};

/** Class recipe for links styled as buttons (e.g. next/link). */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return cn(base, variants[variant], variant === 'link' ? '' : sizes[size], className);
}


'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

export { buttonClasses } from './button-styles';
export type { ButtonVariant, ButtonSize } from './button-styles';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Icon at the inline start (right in RTL). */
  icon?: React.ReactNode;
  /** Icon at the inline end (left in RTL), e.g. <IconNext />. */
  iconEnd?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconEnd,
      fullWidth,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
      {!isLoading && iconEnd}
    </button>
  ),
);
Button.displayName = 'Button';

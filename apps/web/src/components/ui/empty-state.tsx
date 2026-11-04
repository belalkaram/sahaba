'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?:
    | {
        label: string;
        onClick: () => void;
      }
    | React.ReactNode;
  className?: string;
  compact?: boolean;
}

/** Empty state with the Gulf arch frame and a next action — never a bare "0". */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className = '', compact }) => {
  const isActionObject =
    !!action && typeof action === 'object' && 'label' in (action as object) && 'onClick' in (action as object);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border-strong bg-surface',
        compact ? 'gap-3 px-6 py-8' : 'gap-4 px-6 py-12',
        className,
      )}
    >
      <div className="arch relative grid h-16 w-14 place-items-center overflow-hidden bg-primary-subtle text-primary">
        <span className="pattern-overlay" aria-hidden />
        <span className="relative">{icon || <Inbox size={24} strokeWidth={1.75} aria-hidden />}</span>
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-base font-bold text-fg">{title}</h3>
        <p className="text-sm leading-relaxed text-fg-muted">{description}</p>
      </div>
      {action && (
        <div className="mt-1">
          {isActionObject ? (
            <Button size="sm" onClick={(action as { onClick: () => void }).onClick}>
              {(action as { label: string }).label}
            </Button>
          ) : (
            (action as React.ReactNode)
          )}
        </div>
      )}
    </div>
  );
};

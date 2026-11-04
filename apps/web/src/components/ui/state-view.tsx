'use client';

import React from 'react';
import { Skeleton } from './skeleton';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';

export interface StateViewProps {
  isLoading?: boolean;
  error?: Error | string | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  loadingSkeleton?: React.ReactNode;
  children: React.ReactNode;
}

export const StateView: React.FC<StateViewProps> = ({
  isLoading = false,
  error = null,
  isEmpty = false,
  onRetry,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription = 'لم يتم العثور على أي عناصر هنا بعد.',
  emptyAction,
  loadingSkeleton,
  children,
}) => {
  if (isLoading) {
    if (loadingSkeleton) return <>{loadingSkeleton}</>;
    return (
      <div className="space-y-3 p-4 rounded-md border border-border bg-surface">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return <>{children}</>;
};


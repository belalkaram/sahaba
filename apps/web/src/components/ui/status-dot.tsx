'use client';

import React from 'react';

export type StatusType = 'active' | 'inactive' | 'warning' | 'danger' | 'info';

export interface StatusDotProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  className?: string;
}

const statusColors = {
  active: 'bg-success',
  inactive: 'bg-fg-subtle',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  label,
  pulse = false,
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}>
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusColors[status]}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColors[status]}`} />
      </span>
      {label && <span className="text-fg">{label}</span>}
    </span>
  );
};


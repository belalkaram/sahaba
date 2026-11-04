'use client';

import React, { useState } from 'react';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

const statusClasses = {
  online: 'bg-success',
  offline: 'bg-fg-subtle',
  busy: 'bg-danger',
  away: 'bg-warning',
};

function getInitials(name?: string): string {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  // Arabic letters would join into one glyph; a zero-width non-joiner keeps them separate.
  const zwnj = String.fromCharCode(0x200c);
  if (parts.length === 1) {
    return parts[0].charAt(0);
  }
  return (parts[0].charAt(0) + zwnj + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  name,
  size = 'md',
  status,
  className = '',
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-bold bg-primary-subtle text-primary-subtle-fg border border-border select-none`}
      >
        {src && !imageFailed ? (
          <img
            src={src}
            alt={alt || name || ''}
            className="w-full h-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{getInitials(name || alt)}</span>
        )}
      </div>
      {status && (
        <span
          className={`absolute bottom-0 left-0 block rounded-full ring-2 ring-surface ${statusClasses[status]} ${
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
          }`}
          aria-label={status}
        />
      )}
    </div>
  );
};


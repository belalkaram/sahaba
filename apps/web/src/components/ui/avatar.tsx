'use client';

import React, { useState } from 'react';
import BoringAvatar from 'boring-avatars';

/**
 * OD-49: who gets which generated avatar (boring-avatars, rendered as inline SVG). Teachers, staff, parents and
 * platform admins get the sober geometric `bauhaus` on muted colours (`formal`); students get the smiling `beam`
 * on bright colours (`friendly`).
 */
export type AvatarKind = 'formal' | 'friendly';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  /** Stable id (user id) the generated picture is derived from; falls back to the name. */
  seed?: string | null;
  kind?: AvatarKind;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-16 h-16 text-xl',
};

const statusClasses = {
  online: 'bg-success',
  offline: 'bg-fg-subtle',
  busy: 'bg-danger',
  away: 'bg-warning',
};

const statusLabels = {
  online: 'متصل',
  offline: 'غير متصل',
  busy: 'مشغول',
  away: 'بعيد',
};

/** Deep greens, slate and sand for staff; warm bright tones for students. Fixed so both themes read the same. */
const FORMAL_COLORS = ['#1F3631', '#3E5C55', '#7A8F88', '#C9BFA8', '#E8E3D6'];
const FRIENDLY_COLORS = ['#FF8A65', '#FFD166', '#06D6A0', '#4CC9F0', '#B388EB'];

/** Map a role or experience name to the avatar kind. Unknown roles get the formal one. */
export function avatarKindFor(role?: string | null): AvatarKind {
  return role === 'student' ? 'friendly' : 'formal';
}

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

/**
 * A user's picture: the uploaded photo when there is one, otherwise a generated avatar (OD-49), otherwise initials.
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  name,
  seed,
  kind = 'formal',
  size = 'md',
  status,
  className = '',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const label = alt || name || '';
  const generatedSeed = seed || name || null;
  const showPhoto = Boolean(src) && !imageFailed;

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-bold bg-primary-subtle text-primary-subtle-fg shadow-[0_0_0_2px_var(--glass-border)] select-none`}
      >
        {showPhoto ? (
          <img src={src ?? undefined} alt={label} className="w-full h-full object-cover" onError={() => setImageFailed(true)} />
        ) : generatedSeed ? (
          // The seed is an id, so it is never used as the accessible name; the user's name is.
          <span role="img" aria-label={label || undefined} aria-hidden={label ? undefined : true} className="block h-full w-full">
            <BoringAvatar
              name={generatedSeed}
              variant={kind === 'friendly' ? 'beam' : 'bauhaus'}
              colors={kind === 'friendly' ? FRIENDLY_COLORS : FORMAL_COLORS}
              size="100%"
              title={false}
            />
          </span>
        ) : (
          <span aria-label={label || undefined}>{getInitials(name || alt)}</span>
        )}
      </div>
      {status && (
        <span
          className={`absolute bottom-0 left-0 block rounded-full ring-2 ring-surface ${statusClasses[status]} ${
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
          }`}
          aria-label={statusLabels[status]}
        />
      )}
    </div>
  );
};

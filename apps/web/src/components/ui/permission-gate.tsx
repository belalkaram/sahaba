'use client';

/**
 * R1B — PermissionGate
 * Guards UI elements by permission key or experience type.
 * Backed by the canonical AuthSession from /auth/me.
 *
 * NOTE: This is a UI visibility guard only.
 * Backend API endpoints enforce authorization independently.
 */

import React from 'react';
import { useAuth } from '../../context/auth-context';
import { useCan } from '../../hooks/useCan';
import type { Experience } from '../../types/auth';

export interface PermissionGateProps {
  /** Show only if user has this permission in their PermissionsMap */
  permission?: string;
  /** Show only if user's experience matches one of these */
  experience?: Experience | Experience[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  experience,
  fallback = null,
  children,
}) => {
  const { experience: userExperience } = useAuth();
  const hasPermission = useCan(permission ?? '');

  // Check experience restriction
  if (experience !== undefined) {
    const allowed = Array.isArray(experience) ? experience : [experience];
    if (!userExperience || !allowed.includes(userExperience)) {
      return <>{fallback}</>;
    }
  }

  // Check permission restriction
  if (permission !== undefined && !hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

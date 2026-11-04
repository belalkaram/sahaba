'use client';

/**
 * R1B — Can Component
 * Conditionally renders children based on whether the user has the given permission.
 *
 * Usage:
 *   <Can permission="roles.create">
 *     <button>Create Role</button>
 *   </Can>
 *
 *   <Can permission="billing.view" fallback={<p>لا توجد صلاحية</p>}>
 *     <BillingPanel />
 *   </Can>
 */

import React from 'react';
import { useCan } from '../../hooks/useCan';

export interface CanProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ permission, children, fallback = null }) => {
  const hasPermission = useCan(permission);

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};


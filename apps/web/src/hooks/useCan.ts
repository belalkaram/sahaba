/**
 * R1B — useCan Hook
 * Checks the user's PermissionsMap for a given permission key.
 *
 * Usage:
 *   const canCreate = useCan('courses.create');
 *   const scope = usePermissionScope('attendance.scan');
 */

import { useAuth } from '../context/auth-context';
import type { PermissionScope } from '../types/auth';

/**
 * Returns true if the authenticated user has the given permission key
 * in their permissions map (at any scope level).
 */
export function useCan(permission: string): boolean {
  const { permissions } = useAuth();
  return permission in permissions;
}

/**
 * Returns the scope level granted for the permission, or null if not granted.
 * Scope hierarchy: self < linked < own < assigned < branch < tenant
 */
export function usePermissionScope(permission: string): PermissionScope | null {
  const { permissions } = useAuth();
  return permissions[permission] ?? null;
}


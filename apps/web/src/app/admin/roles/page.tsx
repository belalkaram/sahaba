'use client';

/**
 * R1B — Role Management Page
 * Route: /admin/roles
 * Experience guard: admin only.
 *
 * Fetches from:
 *   GET /api/v1/roles       — list of roles (system + custom)
 *   GET /api/v1/permissions — flat list of all permissions
 *
 * Supports:
 *   - View all roles with their permissions
 *   - Create custom role
 *   - Edit custom role permissions
 *   - Delete custom role (with confirmation)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient, ApiError } from '../../../lib/api-client';
import { DataState } from '../../../components/ui/data-state';
import { Can } from '../../../components/guards/Can';

import { TriangleAlert } from 'lucide-react';
import { formatNumber } from '../../../lib/format';
// ---------------------------------------------------------------------------
// Types (matching backend RoleController responses)
// ---------------------------------------------------------------------------

interface RolePermission {
  id: string;
  name: string;
  module: string;
  scope: string;
}

interface Role {
  id: string;
  name: string;
  label: string;
  is_system: boolean;
  permissions: RolePermission[];
}

interface PermissionItem {
  name: string;
  label: string;
  module: string;
  allowed_scopes: string[];
}

// Backend shapes (RoleController): GET /roles → data is an array of roles whose `permissions` is a
// { name: scope } map; GET /permissions → data is { module: { name: { label, scopes } } }.
type ApiRole = Omit<Role, 'permissions'> & { permissions: Record<string, string> | RolePermission[] | null };
type ApiCatalog = Record<string, Record<string, { label?: string; scopes?: string[] }>>;

function toRoles(data: ApiRole[] | { roles?: ApiRole[] } | null | undefined): Role[] {
  const list = Array.isArray(data) ? data : (data?.roles ?? []);
  return list.map((r) => ({
    ...r,
    permissions: Array.isArray(r.permissions)
      ? r.permissions
      : Object.entries(r.permissions ?? {}).map(([name, scope]) => ({ id: name, name, module: name.split('.')[0], scope })),
  }));
}

function toPermissions(data: ApiCatalog | null | undefined): PermissionItem[] {
  return Object.entries(data ?? {}).flatMap(([module, perms]) =>
    Object.entries(perms).map(([name, p]) => ({ name, label: p.label ?? name, module, allowed_scopes: p.scopes ?? ['tenant'] })),
  );
}

async function fetchRolesAndPermissions() {
  const [rolesRes, permsRes] = await Promise.all([
    apiClient.get<ApiRole[]>('/roles'),
    apiClient.get<ApiCatalog>('/permissions'),
  ]);
  return { roles: toRoles(rolesRes.data), permissions: toPermissions(permsRes.data) };
}

type PageState = 'loading' | 'error' | 'ready';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const reloadData = useCallback(async () => {
    try {
      const data = await fetchRolesAndPermissions();
      setRoles(data.roles);
      setPermissions(data.permissions);
      setSelectedRole((prev) => (prev ? (data.roles.find((r) => r.id === prev.id) ?? null) : prev));
      setPageState('ready');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'تعذر تحميل البيانات';
      setErrorMessage(msg);
      setPageState('error');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchRolesAndPermissions()
      .then((data) => {
        if (!isMounted) return;
        setRoles(data.roles);
        setPermissions(data.permissions);
        setPageState('ready');
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg = err instanceof ApiError ? err.message : 'تعذر تحميل البيانات';
        setErrorMessage(msg);
        setPageState('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Create role
  // ---------------------------------------------------------------------------

  const handleCreate = async () => {
    if (!newRoleName.trim() || !newRoleLabel.trim()) return;
    setActionInProgress(true);
    try {
      await apiClient.post('/roles', {
        name: newRoleName.trim(),
        label: newRoleLabel.trim(),
      });
      setIsCreating(false);
      setNewRoleName('');
      setNewRoleLabel('');
      await reloadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'فشل إنشاء الدور');
    } finally {
      setActionInProgress(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle permission on a role
  // ---------------------------------------------------------------------------

  const handleTogglePermission = async (role: Role, permName: string) => {
    if (role.is_system) return; // Cannot edit system roles
    // Send { name: scope } so existing scopes survive the toggle.
    const next: Record<string, string> = Object.fromEntries(role.permissions.map((p) => [p.name, p.scope]));
    if (next[permName]) delete next[permName];
    else next[permName] = permissions.find((p) => p.name === permName)?.allowed_scopes[0] ?? 'tenant';

    setActionInProgress(true);
    try {
      await apiClient.put(`/roles/${role.id}`, {
        label: role.label,
        permissions: next,
      });
      await reloadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'فشل تحديث الصلاحيات');
    } finally {
      setActionInProgress(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete role
  // ---------------------------------------------------------------------------

  const handleDelete = async (roleId: string) => {
    setActionInProgress(true);
    try {
      await apiClient.delete(`/roles/${roleId}`);
      setDeleteConfirmId(null);
      setSelectedRole(null);
      await reloadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'فشل حذف الدور');
    } finally {
      setActionInProgress(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Group permissions by module
  // ---------------------------------------------------------------------------

  const byModule = permissions.reduce<Record<string, PermissionItem[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (pageState === 'loading') return <DataState state="loading" />;
  if (pageState === 'error') return <DataState state="error" message={errorMessage} onRetry={reloadData} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة الأدوار والصلاحيات</h1>
          <p className="text-sm opacity-60 mt-1">
            الأدوار النظامية لا يمكن تعديلها. الأدوار المخصصة قابلة للتعديل والحذف.
          </p>
        </div>
        <Can permission="roles.create">
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 rounded-md bg-[var(--accent)] text-fg text-sm font-bold hover:opacity-90 transition-opacity"
          >
            + إنشاء دور جديد
          </button>
        </Can>
      </div>

      {/* Create role form */}
      {isCreating && (
        <div className="rounded-lg border border-current/10 p-5 space-y-4 bg-[var(--card)]">
          <h2 className="font-bold text-base">إنشاء دور مخصص جديد</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">المعرف (name)</label>
              <input aria-label="المعرف (name)"
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. course_coordinator"
                className="w-full rounded-md border border-current/20 px-3 py-2 text-sm bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">الاسم المعروض (label)</label>
              <input aria-label="الاسم المعروض (label)"
                type="text"
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                placeholder="e.g. منسق المقررات"
                className="w-full rounded-md border border-current/20 px-3 py-2 text-sm bg-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={actionInProgress || !newRoleName.trim() || !newRoleLabel.trim()}
              className="px-4 py-2 rounded-md bg-[var(--accent)] text-fg text-sm font-bold disabled:opacity-50"
            >
              {actionInProgress ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-md border border-current/20 text-sm"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Roles list */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider opacity-50 px-2">الأدوار ({formatNumber(roles.length)})</p>
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role)}
              className={`w-full text-right px-4 py-3 rounded-xl transition-colors ${
                selectedRole?.id === role.id
                  ? 'bg-[var(--accent)] text-fg'
                  : 'bg-[var(--card)] hover:bg-[var(--card)]/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{role.label}</span>
                {role.is_system && (
                  <span className="text-xs bg-current/20 px-2 py-0.5 rounded-full">نظامي</span>
                )}
              </div>
              <p className="text-xs opacity-60 mt-0.5">{role.name}</p>
              <p className="text-xs opacity-50 mt-0.5">{formatNumber(role.permissions.length)} صلاحية</p>
            </button>
          ))}
        </div>

        {/* Permission editor */}
        <div className="rounded-lg border border-current/10 bg-[var(--card)] p-5">
          {!selectedRole ? (
            <div className="flex items-center justify-center h-40 opacity-40 text-sm">
              اختر دوراً من القائمة لعرض وتعديل صلاحياته
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{selectedRole.label}</h2>
                  <p className="text-xs opacity-50">{selectedRole.name} — {formatNumber(selectedRole.permissions.length)} صلاحية</p>
                </div>
                {!selectedRole.is_system && (
                  <Can permission="roles.delete">
                    {deleteConfirmId === selectedRole.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(selectedRole.id)}
                          disabled={actionInProgress}
                          className="px-3 py-1.5 rounded-md bg-danger text-danger-fg text-xs font-bold disabled:opacity-50"
                        >
                          {actionInProgress ? 'جاري الحذف...' : 'تأكيد الحذف'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 rounded-md border border-current/20 text-xs"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(selectedRole.id)}
                        className="px-3 py-1.5 rounded-md border border-danger text-danger text-xs font-bold hover:bg-danger-subtle transition-colors"
                      >
                        حذف الدور
                      </button>
                    )}
                  </Can>
                )}
              </div>

              {selectedRole.is_system && (
                <div className="rounded-md bg-warning-subtle border border-warning/30 text-warning text-xs p-3 dark:bg-warning/20 dark:border-warning dark:text-warning">
                  
 <TriangleAlert size={16} strokeWidth={1.75} aria-hidden /> الأدوار النظامية لا يمكن تعديل صلاحياتها
 </div>
              )}

              {/* Permissions grouped by module */}
              <div className="space-y-4">
                {Object.entries(byModule).map(([module, perms]) => (
                  <div key={module}>
                    <p className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2">
                      {module}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {perms.map((perm) => {
                        const granted = selectedRole.permissions.some((p) => p.name === perm.name);
                        return (
                          <label
                            key={perm.name}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                              granted
                                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                                : 'border-current/10 hover:border-current/30'
                            } ${selectedRole.is_system ? 'pointer-events-none' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={granted}
                              disabled={selectedRole.is_system || actionInProgress}
                              onChange={() => handleTogglePermission(selectedRole, perm.name)}
                              className="accent-[var(--accent)]"
                            />
                            <span className="text-sm">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


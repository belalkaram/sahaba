import { apiClient, type ApiMeta } from './api-client';

export interface ParentProfileItem {
  id: string;
  status: string;
  whatsapp_opt_in?: boolean;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  students?: {
    id: string;
    student_code: string;
    user?: {
      name: string;
      phone: string | null;
    };
    pivot?: {
      relation_type?: string;
    };
  }[];
}

export interface UserSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  persona: 'student' | 'staff' | 'parent';
  status: 'active' | 'suspended';
  branch_id: string | null;
  created_at: string;
  roles?: { id: string; name: string; display_name: string }[];
  student?: {
    id: string;
    student_code: string;
    grade_level: string | null;
    branch_id: string | null;
  } | null;
  staff?: {
    id: string;
    staff_type: string;
  } | null;
  parent?: {
    id: string;
    national_id: string | null;
    whatsapp_opt_in?: boolean;
  } | null;
  parent_profile?: {
    id: string;
    national_id: string | null;
    whatsapp_opt_in?: boolean;
    students?: {
      id: string;
      student_code: string;
      user?: { name: string; phone: string | null };
      pivot?: { relation_type?: string };
    }[];
  } | null;
  children?: { id: string; name: string; student_code: string; relation_type?: string }[];
  parents?: { id: string; name: string; phone: string | null; relation_type?: string }[];
}

export interface UserDetail extends UserSummary {
  effective_permissions?: string[];
  branch?: { id: string; name: string; code: string } | null;
  children?: { id: string; name: string; student_code: string; relation_type?: string }[];
  parents?: { id: string; name: string; phone: string | null; relation_type?: string }[];
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  classrooms_count?: number;
  classrooms?: Classroom[];
}

export interface Classroom {
  id: string;
  branch_id: string;
  name: string;
  code: string | null;
  capacity: number;
  room_type: string;
  is_active: boolean;
}

export interface StudentImportRecord {
  id: string;
  file_name: string;
  total_rows: number;
  imported_count: number;
  failed_count: number;
  status: 'queued' | 'completed' | 'failed' | 'processing';
  summary_log: {
    imported?: { row: number; name: string; code: string }[];
    failed?: { row: number; error: string; raw: Record<string, string> }[];
  } | null;
  created_at: string;
}

export interface TenantCurrentInfo {
  id: string;
  name: string;
  slug: string;
  type: string;
  auth_mode: string;
  status: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  brand_tagline: string | null;
  brand_settings: Record<string, unknown>;
  domains: string[];
  features: string[];
}

export interface RoleItem {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  permissions_count?: number;
  is_system?: boolean;
}

export interface PermissionCatalogCategory {
  category: string;
  permissions: {
    key: string;
    label: string;
    description: string;
    scopes: string[];
  }[];
}

export interface AuditLogItem {
  id: string;
  tenant_id: string;
  actor_id?: string | null;
  actor_type?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_email?: string | null;
  payload?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AuditLogsResponse {
  audit_logs: AuditLogItem[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export const adminApi = {
  // ── Users (R2-1) ────────────────────────────────────────────────────────
  async getUsers(params?: {
    persona?: string;
    role?: string;
    status?: string;
    branch_id?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ users: UserSummary[]; meta: ApiMeta }> {
    const res = await apiClient.get<UserSummary[]>('/users', {
      params: params as Record<string, string | number | boolean>,
    });
    return { users: res.data, meta: res.meta };
  },

  async getUser(id: string): Promise<UserDetail> {
    const res = await apiClient.get<{ user: UserDetail }>(`/users/${id}`);
    return res.data.user;
  },

  async resetPassword(userId: string): Promise<{ temporary_password: string; message: string }> {
    const res = await apiClient.post<{ temporary_password: string; message: string }>(
      `/users/${userId}/reset-password`,
      {}
    );
    return res.data;
  },

  async getUserRoles(userId: string): Promise<{ roles: RoleItem[]; user_id: string }> {
    const res = await apiClient.get<{ roles: RoleItem[]; user_id: string }>(`/users/${userId}/roles`);
    return res.data;
  },

  async updateUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await apiClient.put(`/users/${userId}/roles`, { roles: roleIds });
  },

  async getUserEffectivePermissions(userId: string): Promise<{ effective_permissions: string[] }> {
    const res = await apiClient.get<{ effective_permissions: string[] }>(
      `/users/${userId}/effective-permissions`
    );
    return res.data;
  },

  // ── Students (R2-1) ─────────────────────────────────────────────────────
  async createStudent(payload: {
    name: string;
    email?: string | null;
    phone?: string | null;
    password?: string | null;
    student_code?: string | null;
    grade_level?: string | null;
    branch_id?: string | null;
    parent_id?: string | null;
    parent_name?: string | null;
    parent_phone?: string | null;
    relation_type?: string | null;
  }): Promise<{ user: UserSummary; student: unknown }> {
    const res = await apiClient.post<{ user: UserSummary; student: unknown }>('/students', payload);
    return res.data;
  },

  async updateStudent(
    id: string,
    payload: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      grade_level?: string | null;
      branch_id?: string | null;
    }
  ): Promise<{ student: unknown }> {
    const res = await apiClient.put<{ student: unknown }>(`/students/${id}`, payload);
    return res.data;
  },

  async suspendStudent(id: string): Promise<void> {
    await apiClient.post(`/students/${id}/suspend`, {});
  },

  async activateStudent(id: string): Promise<void> {
    await apiClient.post(`/students/${id}/activate`, {});
  },

  // ── Staff (R2-1) ────────────────────────────────────────────────────────
  async getStaff(params?: { staff_type?: string; branch_id?: string; page?: number }): Promise<{
    staff: unknown[];
    meta: ApiMeta;
  }> {
    const res = await apiClient.get<unknown[]>('/staff', {
      params: params as Record<string, string | number | boolean>,
    });
    return { staff: res.data, meta: res.meta };
  },

  async createStaff(payload: {
    name: string;
    email: string;
    phone?: string | null;
    password?: string | null;
    staff_type?: string;
    roles?: string[];
    branch_ids?: string[];
    bio?: string | null;
  }): Promise<{ user: UserSummary; staff: unknown }> {
    const res = await apiClient.post<{ user: UserSummary; staff: unknown }>('/staff', payload);
    return res.data;
  },

  async getStaffMember(id: string): Promise<{ staff: unknown }> {
    const res = await apiClient.get<{ staff: unknown }>(`/staff/${id}`);
    return res.data;
  },

  async assignStaff(
    id: string,
    payload: {
      classes?: string[];
      courses?: string[];
      branches?: string[];
    }
  ): Promise<void> {
    await apiClient.post(`/staff/${id}/assignments`, payload);
  },
  // ── Parents (R2-1) ──────────────────────────────────────────────────────
  async getParents(params?: { search?: string; page?: number }): Promise<{ parents: ParentProfileItem[]; meta: ApiMeta }> {
    const res = await apiClient.get<{ parents?: ParentProfileItem[] } | ParentProfileItem[]>('/parents', {
      params: params as Record<string, string | number | boolean>,
    });
    const list = Array.isArray(res.data) ? res.data : (res.data?.parents ?? []);
    return { parents: list, meta: res.meta };
  },

  async getStudentsWithoutParent(): Promise<{ students: unknown[] }> {
    const res = await apiClient.get<{ students: unknown[] }>('/students?without_parent=1');
    return res.data;
  },

  async setParentWhatsAppOptIn(parentId: string, optIn: boolean): Promise<void> {
    await apiClient.post(`/parents/${parentId}/whatsapp-opt-in`, { opt_in: optIn });
  },

  async createParent(payload: {
    name: string;
    email?: string | null;
    phone: string;
    password?: string | null;
    national_id?: string | null;
    address?: string | null;
    children?: { student_id: string; relation_type?: string }[];
  }): Promise<{ user: UserSummary; parent: unknown }> {
    const res = await apiClient.post<{ user: UserSummary; parent: unknown }>('/parents', payload);
    return res.data;
  },

  async linkParentChild(
    parentId: string,
    payload: { student_id: string; relation_type?: string }
  ): Promise<void> {
    await apiClient.post(`/parents/${parentId}/children`, payload);
  },

  async unlinkParentChild(parentId: string, studentId: string): Promise<void> {
    await apiClient.delete(`/parents/${parentId}/children/${studentId}`);
  },

  // ── CSV Import (R2-2) ───────────────────────────────────────────────────
  async importStudents(file: File): Promise<StudentImportRecord> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<{ import: StudentImportRecord }>('/students/import', formData);
    return res.data.import;
  },

  async getImports(): Promise<StudentImportRecord[]> {
    const res = await apiClient.get<{ imports: StudentImportRecord[] }>('/imports');
    return res.data.imports ?? [];
  },

  async getImport(id: string): Promise<StudentImportRecord> {
    const res = await apiClient.get<{ import: StudentImportRecord }>(`/imports/${id}`);
    return res.data.import;
  },

  // ── Branches & Classrooms (R2-3) ────────────────────────────────────────
  async getBranches(): Promise<Branch[]> {
    const res = await apiClient.get<{ branches: Branch[] }>('/branches');
    return res.data.branches ?? [];
  },

  async createBranch(payload: {
    name: string;
    code: string;
    address?: string | null;
    phone?: string | null;
    is_active?: boolean;
  }): Promise<Branch> {
    const res = await apiClient.post<{ branch: Branch }>('/branches', payload);
    return res.data.branch;
  },

  async getBranch(id: string): Promise<Branch> {
    const res = await apiClient.get<{ branch: Branch }>(`/branches/${id}`);
    return res.data.branch;
  },

  async updateBranch(id: string, payload: Partial<Branch>): Promise<Branch> {
    const res = await apiClient.put<{ branch: Branch }>(`/branches/${id}`, payload);
    return res.data.branch;
  },

  async deleteBranch(id: string): Promise<void> {
    await apiClient.delete(`/branches/${id}`);
  },

  async getBranchClassrooms(branchId: string): Promise<Classroom[]> {
    const res = await apiClient.get<{ classrooms: Classroom[] }>(`/branches/${branchId}/classrooms`);
    return res.data.classrooms ?? [];
  },

  async createClassroom(
    branchId: string,
    payload: {
      name: string;
      code?: string | null;
      capacity: number;
      room_type?: string;
      is_active?: boolean;
    }
  ): Promise<Classroom> {
    const res = await apiClient.post<{ classroom: Classroom }>(`/branches/${branchId}/classrooms`, payload);
    return res.data.classroom;
  },

  async updateClassroom(id: string, payload: Partial<Classroom>): Promise<Classroom> {
    const res = await apiClient.put<{ classroom: Classroom }>(`/classrooms/${id}`, payload);
    return res.data.classroom;
  },

  async deleteClassroom(id: string): Promise<void> {
    await apiClient.delete(`/classrooms/${id}`);
  },

  // ── Tenant Settings (R2-7) ──────────────────────────────────────────────
  async getTenantCurrent(): Promise<TenantCurrentInfo> {
    const res = await apiClient.get<TenantCurrentInfo>('/tenant/current');
    return res.data;
  },

  async updateTenantSettings(payload: {
    name?: string;
    logo_url?: string | null;
    primary_color?: string;
    secondary_color?: string;
    brand_tagline?: string | null;
    brand_settings?: Record<string, unknown>;
    auth_mode?: string;
  }): Promise<{ tenant: TenantCurrentInfo; message: string }> {
    const res = await apiClient.put<{ tenant: TenantCurrentInfo; message: string }>(
      '/tenant/settings',
      payload
    );
    return res.data;
  },

  async uploadTenantLogo(file: File): Promise<{ tenant: TenantCurrentInfo; logo_url: string; message: string }> {
    const form = new FormData();
    form.append('image', file);
    const res = await apiClient.post<{ tenant: TenantCurrentInfo; logo_url: string; message: string }>('/tenant/logo', form);
    return res.data;
  },

  async deleteTenantLogo(): Promise<{ tenant: TenantCurrentInfo; message: string }> {
    const res = await apiClient.delete<{ tenant: TenantCurrentInfo; message: string }>('/tenant/logo');
    return res.data;
  },

  tenantLogoBlob(): Promise<Blob> {
    return apiClient.blob('/public/academy/logo');
  },

  // ── Roles & Permissions Catalog (R1A/R2) ────────────────────────────────
  async getRoles(): Promise<RoleItem[]> {
    const res = await apiClient.get<{ roles: RoleItem[] }>('/roles');
    return res.data.roles ?? [];
  },

  async getPermissions(): Promise<PermissionCatalogCategory[]> {
    const res = await apiClient.get<{ catalog: PermissionCatalogCategory[] }>('/permissions');
    return res.data.catalog ?? [];
  },

  // ── Tenant Audit Logs (R0-4 / R7E) ──────────────────────────────────────
  async getAuditLogs(params?: {
    action?: string;
    actor_id?: string;
    per_page?: number;
    page?: number;
  }): Promise<AuditLogsResponse> {
    const res = await apiClient.get<AuditLogsResponse>('/audit-logs', { params });
    return res.data;
  },
};


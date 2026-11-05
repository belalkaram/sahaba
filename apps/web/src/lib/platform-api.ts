import { apiClient } from './api-client';
import type { Tenant } from '../types';

export const PLATFORM_TOKEN_KEY = 'platform_admin_token';

export function getPlatformToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setPlatformToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function clearPlatformToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PLATFORM_TOKEN_KEY);
}

function platformAuthHeader(): Record<string, string> {
  const token = getPlatformToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface PlatformMetricsSummary {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  /** Null until the metrics job has run at least once. */
  total_students: number | null;
  total_staff: number | null;
  total_courses: number | null;
  computed_at: string | null;
}

export interface PlatformTenantMetric {
  tenant_id: string;
  slug: string;
  name: string;
  status: string;
  students_count: number | null;
  staff_count: number | null;
  courses_count: number | null;
  storage_bytes: number | null;
  last_activity: string | null;
  metrics_status: 'ok' | 'unavailable' | 'not_computed';
  computed_at: string | null;
}

export interface PlatformMetricsResponse {
  summary: PlatformMetricsSummary;
  tenants: PlatformTenantMetric[];
  queue: { pending: number | null; failed: number | null };
}

export interface PlatformUserInfo {
  id: number | string;
  name: string;
  email: string;
}

export interface PlatformSettings {
  demo_login_enabled: boolean;
}

export interface PlatformAuditItem {
  id: string | number;
  tenant_id?: string | null;
  actor_id?: string | null;
  actor_type?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface PageInfo {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PlatformAuditResponse {
  audit_logs: PlatformAuditItem[];
  pagination: PageInfo;
}

export interface ContactMessageItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  institution: string | null;
  message: string;
  status: 'new' | 'handled';
  created_at: string;
}

export interface ContactMessagesResponse {
  messages: ContactMessageItem[];
  pagination: PageInfo;
}

export interface SupportSessionRecord {
  id: string;
  tenant_id: string;
  platform_user_id: string;
  reason: string;
  status: 'active' | 'ended';
  accessed_at: string;
  expires_at: string;
  ended_at: string | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ProvisionTenantPayload {
  name: string;
  slug: string;
  type?: string;
  organization_kind?: string;
  domain?: string;
  auth_mode?: string;
  modules?: string[];
  owner?: {
    name: string;
    email: string;
    phone?: string | null;
    password: string;
  };
}

export const platformApi = {
  /**
   * Fetch all tenants on the platform.
   */
  async getTenants(): Promise<Tenant[]> {
    const res = await apiClient.get<{ tenants: Tenant[] }>('/tenants', {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data.tenants ?? [];
  },

  /**
   * Provision a new tenant via real TenantProvisioningService.
   */
  async provisionTenant(payload: ProvisionTenantPayload): Promise<Tenant> {
    const res = await apiClient.post<{ tenant: Tenant }>('/tenants', payload, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data.tenant;
  },

  /**
   * Update tenant branding and details.
   */
  async updateTenant(id: string, payload: Partial<Tenant>): Promise<Tenant> {
    const res = await apiClient.put<{ tenant: Tenant }>(`/tenants/${id}`, payload, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data.tenant;
  },

  /**
   * Suspend tenant (real API call).
   */
  async suspendTenant(id: string): Promise<Tenant> {
    const res = await apiClient.post<{ tenant: Tenant }>(`/tenants/${id}/suspend`, {}, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data.tenant;
  },

  /**
   * Activate tenant (real API call).
   */
  async activateTenant(id: string): Promise<Tenant> {
    const res = await apiClient.post<{ tenant: Tenant }>(`/tenants/${id}/activate`, {}, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data.tenant;
  },

  /**
   * Update enabled modules for tenant.
   */
  async updateModules(id: string, modules: string[]): Promise<Tenant> {
    const res = await apiClient.put<{ tenant: Tenant }>(`/tenants/${id}/modules`, { modules }, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data.tenant;
  },

  /**
   * Get platform aggregated metrics.
   */
  async getMetrics(): Promise<PlatformMetricsResponse> {
    const res = await apiClient.get<PlatformMetricsResponse>('/platform/metrics', {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data;
  },

  /** Recompute per-tenant counts now instead of waiting for the hourly job. */
  async refreshMetrics(): Promise<PlatformMetricsResponse> {
    const res = await apiClient.post<PlatformMetricsResponse>('/platform/metrics/refresh', {}, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data;
  },

  /**
   * List platform support sessions.
   */
  async getSupportSessions(): Promise<SupportSessionRecord[]> {
    const res = await apiClient.get<{ support_sessions: SupportSessionRecord[] }>('/platform/support-sessions', {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data.support_sessions ?? [];
  },

  /**
   * Generate a one-time support exchange code for a tenant.
   */
  async generateSupportCode(
    tenantId: string,
    reason: string,
  ): Promise<{ support_code: string; support_code_ttl: number; tenant: string }> {
    const res = await apiClient.post<{
      support_code: string;
      support_code_ttl: number;
      tenant: string;
    }>(`/tenants/${tenantId}/support-access`, { reason }, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data;
  },

  /** Platform sign-in (separate identity from tenant users). */
  async login(email: string, password: string): Promise<void> {
    const res = await apiClient.post<{ token: string }>(
      '/platform/auth/login',
      { email, password },
      { skipUnauthorizedHandler: true },
    );
    setPlatformToken(res.data.token);
  },

  async me(): Promise<PlatformUserInfo> {
    const res = await apiClient.get<{ user?: PlatformUserInfo } & PlatformUserInfo>('/platform/auth/me', {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data.user ?? res.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/platform/auth/logout', {}, {
        headers: platformAuthHeader(),
        skipUnauthorizedHandler: true,
      });
    } finally {
      clearPlatformToken();
    }
  },

  async getSettings(): Promise<PlatformSettings> {
    const res = await apiClient.get<PlatformSettings>('/platform/settings', {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data;
  },

  /** OD-20: toggles the demo accounts shown on the login page. */
  async updateSettings(payload: PlatformSettings): Promise<PlatformSettings> {
    const res = await apiClient.put<PlatformSettings>('/platform/settings', payload, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
    return res.data;
  },

  async getAuditLogs(params: { action?: string; page?: number; per_page?: number }): Promise<PlatformAuditResponse> {
    const res = await apiClient.get<PlatformAuditResponse>('/platform/audit-logs', {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
      params,
    });
    return res.data;
  },

  async getContactMessages(page = 1): Promise<ContactMessagesResponse> {
    const res = await apiClient.get<ContactMessagesResponse>('/platform/contact-messages', {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
      params: { page },
    });
    return res.data;
  },

  async markContactMessageHandled(id: number): Promise<void> {
    await apiClient.post(`/platform/contact-messages/${id}/handled`, {}, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
  },

  /**
   * End support session.
   */
  async endSupportSession(sessionId: string): Promise<void> {
    await apiClient.post(`/platform/support-sessions/${sessionId}/end`, {}, {
      headers: platformAuthHeader(),
      skipUnauthorizedHandler: true,
    });
  },
};

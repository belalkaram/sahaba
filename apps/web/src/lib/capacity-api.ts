import { apiClient } from './api-client';
import { getPlatformToken } from './platform-api';

/** ADR-006 (CAP-1): seats (student = code). Academies read and request; only the platform grants. */

export interface CapacitySummary {
  quota: number;
  used: number;
  available: number;
}

export type CapacityRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TenantCapacityRequest {
  id: string;
  seats_requested: number;
  amount: number | null;
  currency: string;
  note: string | null;
  status: CapacityRequestStatus;
  requested_by_name: string | null;
  seats_granted: number | null;
  quota_after: number | null;
  decision_note: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

export interface TransferDetails {
  bank_name: string | null;
  account_holder_name: string | null;
  iban: string | null;
  instructions: string | null;
  currency: string;
}

export interface PlatformCapacityRequest extends Omit<TenantCapacityRequest, 'requested_by_name'> {
  tenant: { id: string; name: string; slug: string; type: string; seat_quota: number | null } | null;
  has_proof: boolean;
  requested_by_name: string | null;
  seats_used_at_request: number | null;
  quota_at_request: number | null;
  reviewed_by_name: string | null;
}

export interface PlatformTenantCapacity {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  seat_quota: number | null;
  used: number | null;
}

interface Paged<T> {
  items: T[];
  total: number;
  lastPage: number;
}

export const capacityApi = {
  async summary(): Promise<{ capacity: CapacitySummary; pending_request: TenantCapacityRequest | null; transfer: TransferDetails | null }> {
    return (await apiClient.get<{ capacity: CapacitySummary; pending_request: TenantCapacityRequest | null; transfer: TransferDetails | null }>('/tenant/capacity')).data;
  },
  async requests(): Promise<TenantCapacityRequest[]> {
    return (await apiClient.get<{ requests: TenantCapacityRequest[] }>('/tenant/capacity-requests')).data.requests;
  },
  async request(payload: { seats: number; amount: number; proof: File; note?: string }): Promise<TenantCapacityRequest> {
    const form = new FormData();
    form.append('seats', String(payload.seats));
    form.append('amount', String(payload.amount));
    form.append('proof', payload.proof);
    if (payload.note) form.append('note', payload.note);
    return (await apiClient.post<{ request: TenantCapacityRequest }>('/tenant/capacity-requests', form)).data.request;
  },
};

function platformOptions(): { headers: Record<string, string>; skipUnauthorizedHandler: true } {
  const token = getPlatformToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return { headers, skipUnauthorizedHandler: true };
}

export const platformCapacityApi = {
  async requests(params: { status?: CapacityRequestStatus; page?: number }): Promise<Paged<PlatformCapacityRequest>> {
    const res = await apiClient.get<{ requests: PlatformCapacityRequest[] }>('/platform/capacity/requests', { ...platformOptions(), params: { ...params, per_page: 20 } });
    const p = res.meta.pagination;
    return { items: res.data.requests, total: p?.total ?? 0, lastPage: p?.last_page ?? 1 };
  },
  async proof(id: string): Promise<Blob> {
    return apiClient.blob(`/platform/capacity/requests/${id}/proof`, { token: getPlatformToken() ?? undefined, tenant: '' });
  },
  async approve(id: string, payload: { seats_granted?: number; note?: string }): Promise<PlatformCapacityRequest> {
    return (await apiClient.post<{ request: PlatformCapacityRequest }>(`/platform/capacity/requests/${id}/approve`, payload, platformOptions())).data.request;
  },
  async reject(id: string, reason: string): Promise<PlatformCapacityRequest> {
    return (await apiClient.post<{ request: PlatformCapacityRequest }>(`/platform/capacity/requests/${id}/reject`, { reason }, platformOptions())).data.request;
  },
  async tenants(params: { search?: string; page?: number }): Promise<Paged<PlatformTenantCapacity> & { defaultQuota: number }> {
    const res = await apiClient.get<{ tenants: PlatformTenantCapacity[]; default_seat_quota: number }>('/platform/capacity/tenants', { ...platformOptions(), params: { ...params, per_page: 20 } });
    const p = res.meta.pagination;
    return { items: res.data.tenants, total: p?.total ?? 0, lastPage: p?.last_page ?? 1, defaultQuota: res.data.default_seat_quota };
  },
  async setQuota(tenantId: string, seat_quota: number, reason: string): Promise<void> {
    await apiClient.put(`/platform/capacity/tenants/${tenantId}`, { seat_quota, reason }, platformOptions());
  },
  async setDefault(default_seat_quota: number): Promise<number> {
    return (await apiClient.put<{ default_seat_quota: number }>('/platform/capacity/default', { default_seat_quota }, platformOptions())).data.default_seat_quota;
  },
};

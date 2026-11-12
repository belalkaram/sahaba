/**
 * Billing & Packages Domain API Service (Phase R3)
 */
import { apiClient } from './api-client';

export interface PackageEntitlementItem {
  id?: string;
  package_id?: string;
  entitlement_key: string;
  value?: string;
}

export interface PackageItem {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  price: number;
  currency: string;
  billing_cycle?: 'monthly' | 'term' | 'yearly';
  status: 'active' | 'archived';
  entitlements?: PackageEntitlementItem[];
  created_at?: string;
  updated_at?: string;
}

export interface EntitlementItem {
  id: string;
  student_id: string;
  subscription_id?: string | null;
  entitlement_key: string;
  is_active: boolean;
  expires_at?: string | null;
  reason?: string | null;
  granted_by_user_id?: string | null;
  created_at?: string;
}

export interface SubscriptionItem {
  id: string;
  student_id: string;
  package_id: string;
  status: 'active' | 'cancelled' | 'expired';
  starts_at?: string;
  ends_at?: string;
  package?: PackageItem;
  entitlements?: EntitlementItem[];
  created_at?: string;
}

export interface PaymentRequestItem {
  id: string;
  student_id: string;
  package_id?: string | null;
  period_month?: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'approved' | 'rejected';
  sender_phone?: string;
  reference_code?: string;
  proof_url?: string;
  proof_path?: string;
  rejection_reason?: string;
  submitted_at?: string;
  reviewed_at?: string;
  student?: { id: string; user?: { name: string; email?: string; phone?: string } };
  package?: PackageItem;
  reviewer?: { name?: string };
  reviewLogs?: Array<{
    id: string;
    action: string;
    reason?: string;
    logged_at: string;
    reviewer?: { name?: string };
  }>;
  created_at?: string;
}

export const billingApi = {
  // Packages
  async getPackages(status: string = 'active'): Promise<PackageItem[]> {
    const res = await apiClient.get<{ packages: PackageItem[] }>('/packages', {
      params: { status },
    });
    return res.data.packages ?? [];
  },

  async getPackage(id: string): Promise<PackageItem> {
    const res = await apiClient.get<{ package: PackageItem }>(`/packages/${id}`);
    return res.data.package;
  },

  async createPackage(payload: {
    name: string;
    code?: string;
    description?: string;
    price: number;
    currency?: string;
    billing_cycle?: string;
    entitlements?: string[];
  }): Promise<PackageItem> {
    const res = await apiClient.post<{ package: PackageItem }>('/packages', payload);
    return res.data.package;
  },

  async updatePackage(
    id: string,
    payload: Partial<{
      name: string;
      code?: string;
      description?: string;
      price: number;
      currency?: string;
      billing_cycle?: string;
      status?: 'active' | 'archived';
      entitlements?: string[];
    }>
  ): Promise<PackageItem> {
    const res = await apiClient.put<{ package: PackageItem }>(`/packages/${id}`, payload);
    return res.data.package;
  },

  async archivePackage(id: string): Promise<void> {
    await apiClient.post(`/packages/${id}/archive`);
  },

  // Payment Requests
  async getPricing(): Promise<{
    currency: string;
    receiving_account_type: string;
    bank_name?: string | null;
    account_holder_name?: string | null;
    iban?: string | null;
    transfer_instructions?: string | null;
  }> {
    const res = await apiClient.get<{
      currency: string;
      receiving_account_type: string;
      bank_name?: string | null;
      account_holder_name?: string | null;
      iban?: string | null;
      transfer_instructions?: string | null;
    }>('/billing/pricing');
    return res.data;
  },

  async getPaymentRequests(): Promise<PaymentRequestItem[]> {
    const res = await apiClient.get<{ payment_requests: PaymentRequestItem[] }>('/payment-requests');
    return res.data.payment_requests ?? [];
  },

  async getPaymentRequest(id: string): Promise<PaymentRequestItem> {
    const res = await apiClient.get<{ payment_request: PaymentRequestItem }>(`/payment-requests/${id}`);
    return res.data.payment_request;
  },

  async submitPaymentRequest(formData: FormData): Promise<PaymentRequestItem> {
    const res = await apiClient.post<{ payment_request: PaymentRequestItem }>('/payment-requests', formData);
    return res.data.payment_request;
  },

  getPaymentProofUrl(id: string): string {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
    return `${baseUrl}/payment-requests/${id}/proof`;
  },

  async approvePayment(id: string, notes?: string): Promise<void> {
    await apiClient.post(`/payment-requests/${id}/approve`, { notes });
  },

  async rejectPayment(id: string, reason: string): Promise<void> {
    await apiClient.post(`/payment-requests/${id}/reject`, { reason });
  },

  // Student Subscriptions & Entitlements
  async getMySubscriptions(): Promise<SubscriptionItem[]> {
    const res = await apiClient.get<{ subscriptions: SubscriptionItem[] }>('/me/subscriptions');
    return res.data.subscriptions ?? [];
  },

  async getMyEntitlements(): Promise<EntitlementItem[]> {
    const res = await apiClient.get<{ entitlements: EntitlementItem[] }>('/me/entitlements');
    return res.data.entitlements ?? [];
  },

  async getStudentSubscriptions(studentId: string): Promise<SubscriptionItem[]> {
    const res = await apiClient.get<{ subscriptions: SubscriptionItem[] }>(`/students/${studentId}/subscriptions`);
    return res.data.subscriptions ?? [];
  },

  async getStudentEntitlements(studentId: string): Promise<EntitlementItem[]> {
    const res = await apiClient.get<{ entitlements: EntitlementItem[] }>(`/students/${studentId}/entitlements`);
    return res.data.entitlements ?? [];
  },

  async grantEntitlement(
    studentId: string,
    payload: { entitlement_key: string; expires_at?: string | null; reason: string }
  ): Promise<EntitlementItem> {
    const res = await apiClient.post<{ entitlement: EntitlementItem }>(
      `/students/${studentId}/entitlements`,
      payload
    );
    return res.data.entitlement;
  },

  async revokeEntitlement(id: string, reason: string): Promise<void> {
    await apiClient.post(`/entitlements/${id}/revoke`, { reason });
  },
};

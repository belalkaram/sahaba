/**
 * Credentials & Device Binding API Service
 */
import { apiClient } from './api-client';

export interface DeviceBindingItem {
  id: string;
  device_id: string;
  device_name?: string;
  device_fingerprint: string;
  bound_at?: string;
  last_used_at?: string;
  is_active?: boolean;
}

export interface CredentialItem {
  id: string;
  student_id: string;
  credential_code: string;
  status: 'active' | 'revoked' | 'suspended' | 'pending';
  issued_at?: string;
  activated_at?: string;
  expires_at?: string;
  revoked_at?: string;
  revocation_reason?: string;
  device_binding?: DeviceBindingItem;
}

export interface IssueCredentialResponse {
  credential: CredentialItem;
  plain_text_secret: string;
  message: string;
}

export const credentialsApi = {
  async getStudentCredentials(studentId: string): Promise<CredentialItem[]> {
    const res = await apiClient.get<{ credentials: CredentialItem[] }>(`/students/${studentId}/credentials`);
    return res.data.credentials ?? [];
  },

  async issueCredential(studentId: string, expiresAt?: string): Promise<IssueCredentialResponse> {
    const res = await apiClient.post<IssueCredentialResponse>('/credentials', {
      student_id: studentId,
      expires_at: expiresAt,
    });
    return res.data;
  },

  /** Unbinds the current device; the student's next sign-in binds the new one. */
  async replaceDevice(credentialId: string, reason: string): Promise<void> {
    await apiClient.post(`/credentials/${credentialId}/replace-device`, { reason });
  },

  async requestReplacement(
    credentialId: string,
    params: { reason: string; newDeviceName?: string }
  ): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>(
      `/credentials/${credentialId}/request-replacement`,
      {
        reason: params.reason,
        new_device_name: params.newDeviceName,
      }
    );
    return res.data;
  },

  async revoke(credentialId: string, reason: string): Promise<void> {
    await apiClient.post(`/credentials/${credentialId}/revoke`, { reason });
  },
};


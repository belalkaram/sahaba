/**
 * R1B — Auth API
 * Real API calls for login/logout/me, wired to the backend canonical contract.
 */
import { apiClient, ApiError } from './api-client';
import { tokenStore } from './token-store';
import type { AuthSession } from '../types/auth';

export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug: string;
}

export interface LoginResult {
  token: string;
}

/**
 * Authenticate against the tenant API.
 * Returns the raw token only — caller must then call fetchAuthSession().
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  apiClient.setTenant(credentials.tenantSlug);

  const response = await apiClient.post<{ token: string }>('/auth/login', {
    identifier: credentials.email,
    email: credentials.email,
    password: credentials.password,
  });

  const { token } = response.data;

  tokenStore.setToken(token);
  tokenStore.setTenant(credentials.tenantSlug);

  apiClient.setToken(token);
  apiClient.setTenant(credentials.tenantSlug);

  return { token };
}

export interface CouponCredentials {
  couponCode: string;
  secret: string;
  deviceId: string;
  deviceFingerprint: string;
  tenantSlug: string;
}

/** Access-code sign-in for tenants whose auth_mode is `coupon` or `hybrid`. */
export async function loginWithCoupon(credentials: CouponCredentials): Promise<LoginResult> {
  apiClient.setTenant(credentials.tenantSlug);

  const response = await apiClient.post<{ token: string }>('/auth/login', {
    coupon_code: credentials.couponCode,
    secret: credentials.secret,
    device_id: credentials.deviceId,
    device_fingerprint: credentials.deviceFingerprint,
  });

  const { token } = response.data;
  tokenStore.setToken(token);
  tokenStore.setTenant(credentials.tenantSlug);
  apiClient.setToken(token);

  return { token };
}

/** Exchanges a one-time support code from the platform console for a tenant session. */
export async function exchangeSupportCode(code: string, tenantSlug: string): Promise<LoginResult> {
  apiClient.setTenant(tenantSlug);

  const response = await apiClient.post<{ token: string }>('/auth/support/exchange', { code });
  const { token } = response.data;

  tokenStore.setToken(token);
  tokenStore.setTenant(tenantSlug);
  apiClient.setToken(token);

  return { token };
}

/**
 * Fetch the canonical AuthSession from /auth/me.
 * Sets token + tenant on the shared apiClient before the request.
 * Throws ApiError(401) if token is invalid.
 */
export async function fetchAuthSession(token: string, tenantSlug: string): Promise<AuthSession> {
  apiClient.setToken(token);
  apiClient.setTenant(tenantSlug);

  // The backend canonical contract wraps the session in { data: AuthSession }
  const response = await apiClient.get<AuthSession>('/auth/me');
  return response.data;
}

/**
 * Log out — revokes server session and clears local state.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout', {});
  } catch {
    // Server errors on logout are non-fatal — always clear locally
  } finally {
    tokenStore.clearAll();
    apiClient.setToken(null);
  }
}

// ---------------------------------------------------------------------------
// Legacy export — kept so any remaining callers don't break at compile time.
// Prefer fetchAuthSession() for all new code.
// ---------------------------------------------------------------------------

/** @deprecated Use fetchAuthSession() instead */
export async function fetchMe(): Promise<AuthSession> {
  const token = tokenStore.getToken();
  const tenant = tokenStore.getTenant();

  if (!token || !tenant) {
    throw new ApiError('Not authenticated', 'UNAUTHENTICATED', 401);
  }

  return fetchAuthSession(token, tenant);
}

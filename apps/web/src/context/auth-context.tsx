'use client';

/**
 * R1B — Auth Context
 * Consumes the canonical /auth/me contract (AuthSession) from AuthPayloadBuilder.
 * - Fetches full AuthSession on mount if a stored token exists.
 * - Exposes user (with profiles), experience, permissions, tenant, support_session directly.
 * - On 401 response: clears token + session, redirects to /login.
 * - No resolveRole() — experience is computed by the backend.
 */

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import type {
  AuthSession,
  AuthUserWithProfiles,
  Experience,
  PermissionsMap,
  AuthTenant,
  SupportSession,
  UserRole,
} from '../types/auth';
import { apiClient, ApiError } from '../lib/api-client';
import { tokenStore } from '../lib/token-store';
import { exchangeSupportCode, fetchAuthSession, login as apiLogin, loginWithCoupon, logout as apiLogout } from '../lib/auth-api';
import { getDeviceIdentity } from '../lib/device-identity';

export type { UserRole };

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface AuthContextType {
  /** Full canonical session from /auth/me */
  session: AuthSession | null;
  /** Shortcut — session.user augmented with profiles for backward-compatibility */
  user: AuthUserWithProfiles | null;
  /** Shortcut — session.experience */
  experience: Experience | null;
  /** Shortcut — session.permissions */
  permissions: PermissionsMap;
  /** Shortcut — session.tenant */
  tenant: AuthTenant | null;
  /** Shortcut — session.support_session */
  supportSession: SupportSession | null;
  /** True when a valid session is loaded */
  isAuthenticated: boolean;
  /** True while the initial session restore or login/logout is in-flight */
  isLoading: boolean;
  /** Last error message, if any */
  error: string | null;
  /** A token exists but the session could not be loaded (network, rate limit, server error). */
  sessionUnavailable: boolean;
  retrySession: () => void;

  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  supportLogin: (supportCode: string, tenantSlug: string) => Promise<void>;
  couponLogin: (couponCode: string, secret: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Landing page per experience (OD-19: tenant admins have their own dashboard). */
export function homePathFor(experience: Experience | null | undefined): string {
  switch (experience) {
    case 'admin':
      return '/admin';
    case 'staff':
      return '/teacher/dashboard';
    case 'parent':
      return '/parent/dashboard';
    default:
      return '/student/dashboard';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const restoreRef = useRef<(() => Promise<void>) | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On 401 — clear and redirect
  const handleUnauthenticated = useCallback(() => {
    tokenStore.clearAll();
    setSession(null);
    router.push('/login');
  }, [router]);

  // Wire apiClient to trigger handleUnauthenticated on any 401 response
  useEffect(() => {
    apiClient.setUnauthorizedHandler(handleUnauthenticated);
  }, [handleUnauthenticated]);

  // ---------------------------------------------------------------------------
  // Mount: restore session from stored token
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const restore = async () => {
      const storedToken = tokenStore.getToken();
      const storedTenant = tokenStore.getTenant();

      if (!storedToken || !storedTenant) {
        setIsLoading(false);
        return;
      }

      try {
        setSessionUnavailable(false);
        const authSession = await fetchAuthSession(storedToken, storedTenant);
        setSession(authSession);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleUnauthenticated();
        } else {
          // Only a 401 ends the session. A network error, 429 or 5xx is temporary: keep the
          // token so the user is not logged out, and let them retry.
          setSession(null);
          setSessionUnavailable(true);
        }
      } finally {
        setIsLoading(false);
      }
    };
    restoreRef.current = restore;

    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  const login = useCallback(async (email: string, password: string, tenantSlug: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const { token } = await apiLogin({ email, password, tenantSlug });
      const authSession = await fetchAuthSession(token, tenantSlug);
      setSession(authSession);

      // Navigate by backend-computed experience
      router.push(homePathFor(authSession.experience));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // ---------------------------------------------------------------------------
  // Access-code (coupon) login
  // ---------------------------------------------------------------------------

  const couponLogin = useCallback(async (couponCode: string, secret: string, tenantSlug: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const device = getDeviceIdentity();
      const { token } = await loginWithCoupon({
        couponCode,
        secret,
        deviceId: device.id,
        deviceFingerprint: device.fingerprint,
        tenantSlug,
      });
      const authSession = await fetchAuthSession(token, tenantSlug);
      setSession(authSession);
      router.push(homePathFor(authSession.experience));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول بالكود');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // ---------------------------------------------------------------------------
  // Support login (platform token issued via exchange code)
  // ---------------------------------------------------------------------------

  const supportLogin = useCallback(async (supportCode: string, tenantSlug: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const { token } = await exchangeSupportCode(supportCode, tenantSlug);
      const authSession = await fetchAuthSession(token, tenantSlug);
      setSession(authSession);
      router.push(homePathFor(authSession.experience));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول كدعم فني';
      setError(msg);
      tokenStore.clearAll();
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  const refreshSession = useCallback(async () => {
    const storedToken = tokenStore.getToken();
    const storedTenant = tokenStore.getTenant();
    if (!storedToken || !storedTenant) return;
    try {
      const authSession = await fetchAuthSession(storedToken, storedTenant);
      setSession(authSession);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleUnauthenticated();
      }
    }
  }, [handleUnauthenticated]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    await apiLogout();
    setSession(null);
    setIsLoading(false);
    router.push('/login');
  }, [router]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const user: AuthUserWithProfiles | null = session
    ? {
        ...session.user,
        student: session.profiles?.student ?? null,
        staff: session.profiles?.staff ?? null,
        parent: session.profiles?.parent ?? null,
        type: session.type,
      }
    : null;

  const experience = session?.experience ?? null;
  const permissions = session?.permissions ?? {};
  const tenant = session?.tenant ?? null;
  const supportSession = session?.support_session ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        experience,
        permissions,
        tenant,
        supportSession,
        isAuthenticated: !!session,
        isLoading,
        error,
        sessionUnavailable,
        retrySession: () => {
          setIsLoading(true);
          void restoreRef.current?.();
        },
        login,
        supportLogin,
        couponLogin,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

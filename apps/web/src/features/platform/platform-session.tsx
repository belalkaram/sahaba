'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/app-shell';
import { clearPlatformToken, getPlatformToken, platformApi, type PlatformUserInfo } from '../../lib/platform-api';
import { Skeleton } from '../../components/ui/skeleton';

const LOGIN_PATH = '/platform/login';

/**
 * Platform console session. Platform staff are a separate identity from tenant users, so this
 * does not use the tenant auth context: the token lives in sessionStorage and is validated
 * against /platform/auth/me. The backend (platform.auth) remains the security boundary.
 */
export function PlatformSessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === LOGIN_PATH;
  const [user, setUser] = useState<PlatformUserInfo | null>(null);
  const [checking, setChecking] = useState(!isLogin);

  useEffect(() => {
    if (isLogin) return;
    if (!getPlatformToken()) {
      router.replace(LOGIN_PATH);
      return;
    }
    let cancelled = false;
    platformApi
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        clearPlatformToken();
        if (!cancelled) router.replace(LOGIN_PATH);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLogin, router]);

  const logout = useCallback(async () => {
    await platformApi.logout().catch(() => undefined);
    setUser(null);
    router.replace(LOGIN_PATH);
  }, [router]);

  if (isLogin) return <>{children}</>;

  if (checking || !user) {
    return (
      <div className="mx-auto max-w-[var(--content-max)] space-y-6 p-8" aria-busy="true" aria-label="جارٍ التحميل">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <AppShell experienceOverride="admin" area="platform" identity={{ name: user.name || user.email, onLogout: logout }}>
      {children}
    </AppShell>
  );
}

'use client';

import React from 'react';
import { ThemeProvider } from '../context/theme-context';
import { TenantProvider } from '../context/tenant-context';
import { AuthProvider } from '../context/auth-context';
import { ToastProvider } from './ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TenantProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </TenantProvider>
    </ThemeProvider>
  );
}

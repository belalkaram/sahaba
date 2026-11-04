'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Tenant } from '../types';
import { apiClient } from '../lib/api-client';
import { platformApi } from '../lib/platform-api';
import { readableBrandColor } from '../lib/brand-color';

interface TenantContextType {
  currentTenant: Tenant | null;
  setTenantSlug: (slug: string) => void;
  updateCurrentTenantBranding: (branding: Partial<Tenant>) => Promise<void>;
  availableTenants: Tenant[];
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Tenant (academy) branding: only override the brand color when the tenant defines one.
  // The platform default (Sahaba emerald) comes from styles/tokens.css.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const color = readableBrandColor(currentTenant?.primary_color);
    if (color) {
      root.style.setProperty('--brand-primary', color);
    } else {
      root.style.removeProperty('--brand-primary');
    }
  }, [currentTenant]);

  // R7-1: the active tenant comes from the auth session (`useAuth().tenant`). This provider no
  // longer fetches the platform tenant list (a platform-only endpoint) or switches the API
  // client to the first tenant it returns — that could override the signed-in tenant.
  useEffect(() => {
    setLoading(false);
  }, []);

  const setTenantSlug = (slug: string) => {
    const found = availableTenants.find((t) => t.slug === slug);
    if (found) {
      setCurrentTenant(found);
      apiClient.setTenant(found.slug);
    } else {
        // fallback if manually typing a slug that isn't loaded
        apiClient.setTenant(slug);
    }
  };

  const updateCurrentTenantBranding = async (branding: Partial<Tenant>) => {
    if (!currentTenant) return;
    try {
      const updated = await platformApi.updateTenant(currentTenant.id, branding);
      setCurrentTenant(updated);
      setAvailableTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (e) {
      // Optimistic fallback
      setCurrentTenant(prev => prev ? { ...prev, ...branding } : null);
    }
  };

  return (
    <TenantContext.Provider value={{ currentTenant, setTenantSlug, updateCurrentTenantBranding, availableTenants, loading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

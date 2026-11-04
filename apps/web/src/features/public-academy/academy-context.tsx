'use client';

import React, { createContext, useContext } from 'react';

export interface AcademyInfo {
  slug: string;
  name: string;
  logo_url: string | null;
  brand_tagline: string | null;
}

const AcademyContext = createContext<AcademyInfo | null>(null);

export const AcademyProvider = AcademyContext.Provider;

/** The academy whose public pages are being shown (from the URL slug — never from a session). */
export function useAcademy(): AcademyInfo {
  const ctx = useContext(AcademyContext);
  if (!ctx) throw new Error('useAcademy must be used inside the academy layout');
  return ctx;
}

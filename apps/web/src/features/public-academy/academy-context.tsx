'use client';

import React, { createContext, useContext } from 'react';
import type { AcademyProfile } from '../../lib/public-api';

export type AcademyInfo = AcademyProfile;

const AcademyContext = createContext<AcademyInfo | null>(null);

export const AcademyProvider = AcademyContext.Provider;

/** The academy whose public pages are being shown (from the URL slug — never from a session). */
export function useAcademy(): AcademyInfo {
  const ctx = useContext(AcademyContext);
  if (!ctx) throw new Error('useAcademy must be used inside the academy layout');
  return ctx;
}

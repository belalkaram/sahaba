'use client';

/**
 * R7F — Platform console layout: its own session (not the tenant experience guard).
 */

import React from 'react';
import { PlatformSessionGate } from '../../features/platform/platform-session';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlatformSessionGate>{children}</PlatformSessionGate>;
}

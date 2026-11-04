'use client';

/**
 * R1B — Support Session Banner
 * Shows a persistent banner when a platform support session is active.
 * Calls POST /api/v1/platform/support-sessions/{id}/end on "إنهاء الجلسة".
 */

import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/auth-context';
import { apiClient } from '../../lib/api-client';
import { formatNumber } from '../../lib/format';

function minutesUntil(isoDate: string): number {
  const expiresAt = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((expiresAt - now) / 60_000));
}

export const SupportSessionBanner: React.FC = () => {
  const { supportSession, logout } = useAuth();
  const [isEnding, setIsEnding] = useState(false);

  if (!supportSession) return null;

  const minutesLeft = minutesUntil(supportSession.expires_at);

  const handleEnd = async () => {
    setIsEnding(true);
    try {
      await apiClient.post(`/platform/support-sessions/${supportSession.id}/end`, {});
    } catch {
      // Session end is best-effort — always logout locally
    } finally {
      await logout();
    }
  };

  return (
    <div
      role="alert"
      className="relative z-[45] flex w-full items-center justify-between gap-3 border-b border-warning/30 bg-warning-subtle px-4 py-2 text-sm text-warning-subtle-fg"
    >
      <span className="flex items-center gap-2">
        <ShieldAlert size={16} aria-hidden />
        <strong>جلسة دعم فني نشطة</strong>
        <span>تنتهي خلال {formatNumber(minutesLeft)} دقيقة</span>
      </span>
      <button
        type="button"
        onClick={handleEnd}
        disabled={isEnding}
        className="h-8 rounded-sm bg-warning px-3 text-xs font-bold text-warning-fg transition-colors hover:bg-warning-hover disabled:opacity-60"
      >
        {isEnding ? 'جارٍ الإنهاء…' : 'إنهاء الجلسة'}
      </button>
    </div>
  );
};

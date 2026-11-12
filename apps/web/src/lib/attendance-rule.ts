import { useAuth } from '../context/auth-context';

/**
 * OD-35: each academy decides whether a minimum attendance rate is required to sit exams (null = no rule).
 * The UI states the academy's own rule only; it never shows a threshold the academy did not set.
 */
export function useAttendanceMinimum(): number | null {
  const { tenant } = useAuth();
  const value = tenant?.min_attendance_for_exams;
  return typeof value === 'number' && value > 0 ? value : null;
}

/** Progress-bar colour: compared with the academy's rule when there is one, neutral otherwise. */
export function attendanceVariant(rate: number | null, minimum: number | null): 'primary' | 'success' | 'danger' {
  if (rate === null || minimum === null) return 'primary';
  return rate >= minimum ? 'success' : 'danger';
}

export function isBelowMinimum(rate: number | null, minimum: number | null): boolean {
  return rate !== null && minimum !== null && rate < minimum;
}

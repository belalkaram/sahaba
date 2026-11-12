import type { DirectoryAcademy, DirectoryTeacher, Pagination, PublicPricing, PublicStats } from '../../lib/public-api';
import type { DirectoryInitial } from '../directory/directory-view';

/** How long public pages keep directory data before asking the API again (seconds). */
export const LANDING_REVALIDATE_SECONDS = 300;

/**
 * API origin as seen from the Next server. In production NEXT_PUBLIC_API_URL is a relative path
 * behind nginx, which the server cannot fetch, so API_INTERNAL_URL points at the API service.
 */
function serverApiBase(): string | null {
  const base = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || '';
  return /^https?:\/\//.test(base) ? base.replace(/\/$/, '') : null;
}

/**
 * Reads a public endpoint on the server so its data is part of the HTML. Returns null when the
 * server could not ask the API (not configured, API down at build time); the caller then falls
 * back to loading in the browser or to showing nothing.
 */
async function getPublic<T>(path: string): Promise<{ data: T; meta: { pagination?: Pagination } } | null> {
  const base = serverApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: LANDING_REVALIDATE_SECONDS },
      // The API may be a single-threaded dev server while several pages prerender at once.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T; meta?: { pagination?: Pagination } };
    return body.data === undefined ? null : { data: body.data, meta: body.meta ?? {} };
  } catch {
    return null;
  }
}

/**
 * Opted-in teachers for the landing rail. `null` means the server could not ask the API — the
 * section then loads the list in the browser instead of silently showing nothing.
 */
export async function getLandingTeachers(): Promise<DirectoryTeacher[] | null> {
  const res = await getPublic<{ teachers: DirectoryTeacher[] }>('/public/directory/teachers?per_page=6');
  return res ? (res.data.teachers ?? []) : null;
}

/** Academies that opted into the public directory, featured first; `null` as above. */
export async function getLandingAcademies(): Promise<DirectoryAcademy[] | null> {
  const res = await getPublic<{ academies: DirectoryAcademy[] }>('/public/directory/academies?per_page=6');
  return res ? (res.data.academies ?? []) : null;
}

/** Real platform numbers; null keeps the trust strip on its labelled sample content. */
export async function getLandingStats(): Promise<PublicStats | null> {
  return (await getPublic<PublicStats>('/public/stats'))?.data ?? null;
}

/** What the platform charges (OD-39); null falls back to the wording in the section itself. */
export async function getLandingPricing(): Promise<PublicPricing | null> {
  return (await getPublic<PublicPricing>('/public/pricing'))?.data ?? null;
}

/** First page of a directory page (/academies, /teachers), rendered on the server. */
export async function getDirectoryPage<T extends DirectoryAcademy | DirectoryTeacher>(
  kind: 'academies' | 'teachers',
): Promise<DirectoryInitial<T>> {
  const res = await getPublic<Record<string, T[]>>(`/public/directory/${kind}?per_page=12`);
  return { items: (res?.data?.[kind] as T[]) ?? [], pagination: res?.meta.pagination ?? null };
}

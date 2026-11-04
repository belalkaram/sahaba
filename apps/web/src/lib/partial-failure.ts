import { ApiError } from './api-client';

/**
 * Operating Rule §4: a failed request must not look like empty data.
 *
 *   educationApi.getCourses().catch(partial([]))
 *
 * keeps the page usable with the fallback and reports the failure, so AppShell can tell the user
 * that part of the page did not load. A 403 is not reported: the user simply has no access to that
 * section. A 401 is handled globally (sign-in).
 */

const EVENT = 'sahaba:partial-failure';

export function partial<T>(fallback: T): (error: unknown) => T {
  return (error) => {
    const status = error instanceof ApiError ? error.status : undefined;
    if (status !== 401 && status !== 403 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(EVENT));
    }
    return fallback;
  };
}

export function onPartialFailure(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

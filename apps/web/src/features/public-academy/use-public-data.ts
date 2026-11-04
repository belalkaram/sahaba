'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api-client';

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'not_found' }
  | { status: 'error'; retry: () => void };

/** Loads public data and keeps "not found" and "failed" distinct from "empty". */
export function usePublicData<T>(loader: () => Promise<T>, deps: unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loader()
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setState({ status: 'not_found' });
        else setState({ status: 'error', retry });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return state;
}

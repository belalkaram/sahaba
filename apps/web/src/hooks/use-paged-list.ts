'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api-client';

export interface Page<T> {
  items: T[];
  total: number;
  lastPage: number;
}

export type PagedListState<T> = {
  items: T[];
  total: number;
  /** First page still loading (show a skeleton). */
  loading: boolean;
  /** A later page is loading (keep the list, show a spinner on the button). */
  loadingMore: boolean;
  hasMore: boolean;
  /** Distinguishes "failed" from "empty"; 403 is reported separately. */
  error: 'forbidden' | 'failed' | null;
  loadMore: () => void;
  retry: () => void;
};

/**
 * Progressive list loading: the first page on mount (and whenever `key` changes, e.g. filters or a debounced
 * search), further pages on demand. Out-of-date responses are ignored, so fast filter changes never mix results.
 */
export function usePagedList<T extends { id: string }>(fetchPage: (page: number) => Promise<Page<T>>, key: string): PagedListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<PagedListState<T>['error']>(null);
  const [attempt, setAttempt] = useState(0);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const generation = useRef(0);

  const load = useCallback(async (target: number, reset: boolean) => {
    const mine = ++generation.current;
    reset ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const res = await fetchRef.current(target);
      if (mine !== generation.current) return;
      setItems((prev) => {
        if (reset) return res.items;
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setTotal(res.total);
      setLastPage(res.lastPage);
      setPage(target);
    } catch (err) {
      if (mine !== generation.current) return;
      setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'failed');
    } finally {
      if (mine === generation.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    setItems([]);
    void load(1, true);
  }, [key, attempt, load]);

  return {
    items,
    total,
    loading,
    loadingMore,
    hasMore: page < lastPage,
    error,
    loadMore: () => {
      if (!loadingMore && !loading && page < lastPage) void load(page + 1, false);
    },
    retry: () => setAttempt((n) => n + 1),
  };
}

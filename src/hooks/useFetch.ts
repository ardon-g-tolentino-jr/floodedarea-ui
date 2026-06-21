import React from 'react';

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface FetchResult<T> extends FetchState<T> {
  /** Re-run the fetcher; pass `background` to skip the loading flash. */
  refetch: (background?: boolean) => Promise<void>;
}

/**
 * Generic data-fetching hook. Re-runs whenever any of `deps` change. Stale responses are
 * ignored via a request-id ref (no AbortController, which keeps React 18 strict mode quiet).
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList
): FetchResult<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const reqId = React.useRef(0);

  const fetcherRef = React.useRef(fetcher);
  React.useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const run = React.useCallback(async (background = false): Promise<void> => {
    const myId = ++reqId.current;
    if (!background) setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (myId === reqId.current) {
        setData(result);
        setLoading(false);
      }
    } catch (e) {
      if (myId === reqId.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run };
}

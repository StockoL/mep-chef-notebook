import { useEffect, useState } from 'preact/hooks';

/**
 * Runs an async task once (or when `deps` change) and returns its result;
 * undefined until it's done. For one-off answers that aren't database reads,
 * such as asking the browser about storage. Database reads use useLiveQuery.
 */
export function usePromise<T>(task: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<{ result: T }>();
  useEffect(() => {
    let cancelled = false;
    void task().then((result) => !cancelled && setValue({ result }));
    return () => {
      cancelled = true;
    };
  }, deps);
  return value?.result;
}

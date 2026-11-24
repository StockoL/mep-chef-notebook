import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/**
 * Runs a data-layer query and re-runs it whenever the tables it read change,
 * so a screen updates by itself when anything is saved (DESIGN → UI code).
 * Returns undefined until the first answer arrives.
 *
 *   const notes = useLiveQuery(() => listInbox());
 *
 * `deps` works like useEffect's: re-subscribe when these change.
 */
export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (error) => console.error('Live query failed', error),
    });
    return () => subscription.unsubscribe();
  }, deps);

  return value;
}

import { useEffect, useRef } from 'preact/hooks';
import { trackSave } from '../saveStatus';

/**
 * Saves typed text without a Save button (UX rule 4), so nothing is lost
 * whatever the chef does next:
 * - `delay` ms after typing stops;
 * - when the field is left (call flush from onBlur);
 * - when the app goes to the background or the page closes;
 * - when the screen closes (the component unmounts).
 * Each save shows in the save indicator.
 *
 *   const { change, flush } = useAutosave((text) => saveSteps(id, text), 800);
 *   <textarea onInput={(e) => change(e.currentTarget.value)} onBlur={flush} />
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>, delay: number) {
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = () => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (next) void trackSave(saveRef.current(next.value));
  };

  const change = (value: T) => {
    pending.current = { value };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  };

  useEffect(() => {
    const onHidden = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  return { change, flush };
}

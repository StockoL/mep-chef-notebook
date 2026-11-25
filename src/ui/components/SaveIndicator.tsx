import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../icons';
import { onSaveState, type SaveState } from '../saveStatus';

/** How long "Saved" stays after the last save. */
const SHOW_SAVED_MS = 2500;

/**
 * "Saving…" / "Saved ✓" / "Couldn't save", in the header of a screen or sheet,
 * for anything saved through trackSave(). Announced politely to screen readers.
 */
export function SaveIndicator() {
  const [state, setState] = useState<SaveState | null>(null);

  useEffect(() => onSaveState(setState), []);

  useEffect(() => {
    if (state !== 'saved') return;
    const timer = setTimeout(() => setState(null), SHOW_SAVED_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <span class="save-indicator" data-state={state ?? undefined} role="status" aria-live="polite">
      {state === 'saving' && 'Saving…'}
      {state === 'saved' && (
        <>
          <Icon name="tick" /> Saved
        </>
      )}
      {state === 'failed' && 'Couldn’t save'}
    </span>
  );
}

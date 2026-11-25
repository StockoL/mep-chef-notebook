/**
 * Feedback for automatic saving. Nothing in Mep needs a Save button (UX rule 4),
 * so every save says so: wrap it in trackSave() and the header of the current
 * screen or sheet shows "Saving…" then "Saved ✓" (or "Couldn't save").
 *
 *   onInput={(e) => trackSave(updateService(id, { windows }))}
 */

export type SaveState = 'saving' | 'saved' | 'failed';

const listeners = new Set<(state: SaveState) => void>();
let pending = 0;

export function onSaveState(listener: (state: SaveState) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function emit(state: SaveState) {
  listeners.forEach((listener) => listener(state));
}

/** Reports a save as it happens; passes its result (or error) straight through. */
export async function trackSave<T>(save: Promise<T>): Promise<T> {
  pending++;
  emit('saving');
  try {
    const result = await save;
    pending--;
    if (pending === 0) emit('saved');
    return result;
  } catch (error) {
    pending--;
    emit('failed');
    throw error;
  }
}

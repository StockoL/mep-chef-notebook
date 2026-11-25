import type { RefObject } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { createTextNote, discardIfEmpty, updateNoteBody } from '../../data/notes';
import type { Id } from '../../data/types';
import { paths } from '../router';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

interface NoteSheetProps {
  open: boolean;
  onClose: () => void;
  dialogRef: RefObject<HTMLDialogElement | null>;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * Writing a quick note. It saves from the first keystroke (UX → Editing rule
 * 2), so being called to the pass mid-sentence loses nothing. No Save button.
 */
export function NoteSheet({ open, onClose, dialogRef, fieldRef }: NoteSheetProps) {
  const [text, setText] = useState('');
  // The note's id once created, and a queue so saves land in typing order.
  const saving = useRef<{ id: Promise<Id> | null; queue: Promise<unknown> }>({ id: null, queue: Promise.resolve() });

  function onInput(value: string) {
    setText(value);
    const state = saving.current;
    if (!state.id) {
      state.id = createTextNote(value);
      state.queue = state.id;
    } else {
      const id = state.id;
      state.queue = state.queue.then(() => id).then((noteId) => updateNoteBody(noteId, value));
    }
  }

  async function close() {
    const state = saving.current;
    saving.current = { id: null, queue: Promise.resolve() };
    const hadText = text.trim().length > 0;
    setText('');
    onClose();
    if (state.id) {
      await state.queue;
      await discardIfEmpty(await state.id);
      if (hadText) showMessage('Note saved to your inbox.', { view: { href: paths.inbox } });
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Note" position="top" keepMounted dialogRef={dialogRef}>
      <label class="visually-hidden" for="capture-note">
        Note
      </label>
      <textarea
        ref={fieldRef}
        id="capture-note"
        class="textarea note-sheet__field"
        rows={6}
        value={text}
        placeholder="Chef says: less salt in the beurre blanc…"
        onInput={(e) => onInput(e.currentTarget.value)}
      />
      <p class="field__hint">Saved as you type. Sort it from the inbox later.</p>
    </Sheet>
  );
}

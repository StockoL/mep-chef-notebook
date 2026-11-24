import { useRef, useState } from 'preact/hooks';
import { createMediaNote } from '../../data/notes';
import { Icon } from '../icons';
import { shrinkPhoto } from '../media';
import { NoteSheet } from './NoteSheet';
import { showMessage } from './UndoBar';
import { VoiceSheet } from './VoiceSheet';
import { WasteSheet } from './WasteSheet';

/**
 * Above the tabs on every main screen (C1, C2, A4): one tap to write a note,
 * and photo, voice and waste one tap each. Everything saves at once, tagged
 * with the current kitchen, section and time.
 *
 * Common path for a note: tap the bar → type → Done (2 taps).
 */
export function CaptureBar() {
  const noteDialog = useRef<HTMLDialogElement>(null);
  const noteField = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);

  // iPhone only shows the keyboard if focus happens inside the tap itself,
  // so the sheet is opened and the field focused right here, not after a render.
  function openNote() {
    setNoteOpen(true);
    noteDialog.current?.showModal();
    noteField.current?.focus();
  }

  async function onPhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await createMediaNote(await shrinkPhoto(file));
    showMessage('Photo saved to your inbox.');
  }

  return (
    <div class="capture-bar">
      <button class="capture-bar__note" type="button" onClick={openNote}>
        Jot a note…
      </button>
      <button class="capture-bar__action" type="button" aria-label="Photo" onClick={() => photoInput.current?.click()}>
        <Icon name="camera" />
      </button>
      <button class="capture-bar__action" type="button" aria-label="Voice note" onClick={() => setVoiceOpen(true)}>
        <Icon name="mic" />
      </button>
      <button class="capture-bar__action" type="button" aria-label="Log waste" onClick={() => setWasteOpen(true)}>
        <Icon name="bin" />
      </button>

      {/* capture="environment" opens the back camera straight away. */}
      <input
        ref={photoInput}
        class="visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPhoto}
      />

      <NoteSheet open={noteOpen} onClose={() => setNoteOpen(false)} dialogRef={noteDialog} fieldRef={noteField} />
      <VoiceSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      <WasteSheet open={wasteOpen} onClose={() => setWasteOpen(false)} />
    </div>
  );
}

import { useRef, useState } from 'preact/hooks';
import { createMediaNote } from '../../data/notes';
import { Icon } from '../icons';
import { shrinkPhoto, unlockAudio } from '../media';
import { paths } from '../router';
import { NoteSheet } from './NoteSheet';
import { showMessage } from './UndoBar';
import { VoiceSheet } from './VoiceSheet';

/**
 * Above the tabs on every main screen (C1, C2): one tap to write a note,
 * and photo and voice one tap each. Everything saves at once, tagged with
 * the current kitchen and the time. Waste is logged from the Section tab,
 * at the end of a shift (A4).
 *
 * Common path for a note: tap the bar → type → Done (2 taps).
 */
export function CaptureBar() {
  const noteDialog = useRef<HTMLDialogElement>(null);
  const noteField = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

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
    showMessage('Saving photo…');
    await createMediaNote(await shrinkPhoto(file));
    showMessage('Photo saved to your inbox.', { view: { href: paths.inbox } });
  }

  return (
    <div class="capture-bar">
      <button class="capture-bar__note" type="button" onClick={openNote}>
        Jot a note…
      </button>
      <button class="capture-bar__action" type="button" aria-label="Photo" onClick={() => photoInput.current?.click()}>
        <Icon name="camera" />
      </button>
      <button
        class="capture-bar__action"
        type="button"
        aria-label="Voice note"
        onClick={() => {
          unlockAudio(); // inside the tap, so the level meter can hear
          setVoiceOpen(true);
        }}
      >
        <Icon name="mic" />
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
    </div>
  );
}

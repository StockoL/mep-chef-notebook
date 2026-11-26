import { useLocation } from 'preact-iso';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createMediaNote } from '../../data/notes';
import { Icon } from '../icons';
import { shrinkPhoto, unlockAudio } from '../media';
import { paths } from '../router';
import { NoteSheet } from './NoteSheet';
import { showMessage } from './UndoBar';
import { VoiceSheet } from './VoiceSheet';

/**
 * Where the capture bar earns its place (FEEL_PASS 7, DECISIONS 56): Today,
 * Plan, Section and the inbox, where things get captured. Not in the library,
 * settings, kitchen settings, prep mode or any edit mode.
 */
function capturesHere(path: string, editing: boolean): boolean {
  if (editing) return false;
  // The router may give Today's path with or without its trailing slash.
  const trim = (p: string) => p.replace(/\/$/, '');
  if (trim(path) === trim(paths.today) || trim(path) === trim(paths.inbox)) return true;
  if (path.startsWith(paths.prep)) return false;
  return path.startsWith(paths.plan) || path.startsWith(paths.section);
}

/**
 * Tucked away while scrolling down, back when scrolling up or stopping.
 * Changing the bar's height moves the page, so scroll events just after a
 * change are ignored rather than read as the chef scrolling.
 */
function useTuckOnScroll(active: boolean): boolean {
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    setTucked(false);
    if (!active) return;
    let last = window.scrollY;
    let settleUntil = 0;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const change = (next: boolean) => {
      setTucked((current) => {
        if (current !== next) settleUntil = Date.now() + 350;
        return next;
      });
    };
    const onScroll = () => {
      const y = window.scrollY;
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => change(false), 700);
      if (Date.now() < settleUntil) {
        last = y;
        return;
      }
      if (y > last + 8 && y > 40) change(true);
      else if (y < last - 8) change(false);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(stopTimer);
    };
  }, [active]);
  return tucked;
}

/**
 * Above the tabs on the screens where things get captured (C1, C2): one tap
 * to write a note, and photo and voice one tap each. Everything saves at
 * once, tagged with the current kitchen and the time. Waste is logged from
 * the Section tab, at the end of a shift (A4).
 *
 * Common path for a note: tap the bar → type → Done (2 taps).
 */
export function CaptureBar() {
  const { path, query } = useLocation();
  const shown = capturesHere(path, query.edit === '1');
  const tucked = useTuckOnScroll(shown);
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

  const away = !shown || tucked;
  return (
    <>
      {/* The sheets stay outside the part that folds away: a note being written survives a scroll. */}
      <div class="capture-dock" data-away={away} inert={away}>
        <div class="capture-dock__inner">
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
          </div>
        </div>
      </div>

      <NoteSheet open={noteOpen} onClose={() => setNoteOpen(false)} dialogRef={noteDialog} fieldRef={noteField} />
      <VoiceSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </>
  );
}

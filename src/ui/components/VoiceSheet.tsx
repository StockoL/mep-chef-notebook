import { useEffect, useRef, useState } from 'preact/hooks';
import { formatMinutes } from '../../core/time/formatMinutes';
import { createMediaNote } from '../../data/notes';
import { startRecording, type Recording } from '../media';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

/**
 * Recording a voice note (C2). Recording starts as the sheet opens; Done
 * saves it to the inbox, Discard throws it away.
 * Common path: tap the mic → speak → Done (2 taps).
 */
export function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const recording = useRef<Recording | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSeconds(0);
    setProblem('');
    startRecording()
      .then((started) => {
        if (cancelled) started.cancel();
        else recording.current = started;
      })
      .catch(() => setProblem('Mep can’t use the microphone. Allow it in your phone’s settings for this app.'));
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open]);

  async function save() {
    const current = recording.current;
    recording.current = null;
    onClose();
    if (!current) return;
    await createMediaNote(await current.stop());
    showMessage('Voice note saved to your inbox.');
  }

  function discard() {
    recording.current?.cancel();
    recording.current = null;
    onClose();
  }

  return (
    <Sheet open={open} onClose={save} title="Voice note">
      {problem ? (
        <p role="alert">{problem}</p>
      ) : (
        <p class="voice-sheet__time" aria-live="off">
          <span class="voice-sheet__dot" aria-hidden="true" /> Recording · {formatMinutes(seconds / 60)}{' '}
          <span class="visually-hidden">({seconds} seconds)</span>
        </p>
      )}
      <p class="field__hint">Done saves it to your inbox.</p>
      <button class="button" type="button" data-variant="danger" onClick={discard}>
        Discard
      </button>
    </Sheet>
  );
}

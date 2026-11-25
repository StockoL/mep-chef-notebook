import { useEffect, useRef, useState } from 'preact/hooks';
import { createMediaNote } from '../../data/notes';
import { paths } from '../router';
import { formatClock } from '../format';
import { startRecording, type Recording } from '../media';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

type Status = 'starting' | 'recording' | 'problem';

/**
 * Recording a voice note (C2). Recording starts as the sheet opens, and the
 * sheet shows it's working: a pulsing red dot, a stopwatch counting seconds,
 * and a level bar that moves with your voice. Done saves it to the inbox;
 * Discard throws it away.
 * Common path: tap the mic → speak → Done (2 taps).
 */
export function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const recording = useRef<Recording | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let frame = 0;
    let startedAt = 0;
    setStatus('starting');
    setSeconds(0);
    setLevel(0);

    const tick = () => {
      if (recording.current) {
        setLevel(recording.current.level());
        setSeconds((performance.now() - startedAt) / 1000);
      }
      frame = requestAnimationFrame(tick);
    };

    startRecording()
      .then((started) => {
        if (cancelled) return started.cancel();
        recording.current = started;
        startedAt = performance.now();
        setStatus('recording');
        frame = requestAnimationFrame(tick);
      })
      .catch(() => setStatus('problem'));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [open]);

  async function save() {
    const current = recording.current;
    recording.current = null;
    onClose();
    if (!current) return;
    await createMediaNote(await current.stop());
    showMessage('Voice note saved to your inbox.', { view: { href: paths.inbox } });
  }

  function discard() {
    recording.current?.cancel();
    recording.current = null;
    onClose();
    showMessage('Voice note discarded.');
  }

  return (
    <Sheet open={open} onClose={save} title="Voice note">
      {status === 'problem' ? (
        <p role="alert">Mep can’t use the microphone. Allow it in your phone’s settings for Mep, then try again.</p>
      ) : (
        <div class="voice-meter flow" data-status={status}>
          <p class="voice-meter__status" role="status">
            <span class="voice-meter__dot" aria-hidden="true" />
            {status === 'starting' ? 'Starting the microphone…' : 'Recording'}
          </p>
          <p class="voice-meter__clock" aria-hidden="true">
            {formatClock(seconds)}
          </p>
          <div class="voice-meter__level" aria-hidden="true">
            <span style={{ inlineSize: `${Math.round(level * 100)}%` }} />
          </div>
        </div>
      )}
      <p class="field__hint">Done saves it to your inbox.</p>
      <button class="button" type="button" data-variant="danger" onClick={discard}>
        Discard
      </button>
    </Sheet>
  );
}

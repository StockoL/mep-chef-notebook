/** Photo and voice capture in the browser (C2). */

/** The longest side a saved photo may have (DECISIONS 33). */
const MAX_PHOTO_EDGE = 2000;

/**
 * Shrinks a camera photo to JPEG with its long edge at most 2000 px.
 * Smaller photos are re-saved as JPEG too, which also turns HEIC into
 * something every device can show. If the browser can't read the image,
 * the original is kept rather than losing the photo.
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    // from-image: respect the photo's orientation, so portrait shots stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  return jpeg ?? file;
}

/**
 * The audio context behind the level meter. Browsers (Safari included) start
 * an AudioContext paused unless it's created or resumed inside a tap, so the
 * mic button calls unlockAudio() in its click handler, before anything else.
 */
let audioContext: AudioContext | null = null;

export function unlockAudio(): void {
  audioContext ??= new AudioContext();
  void audioContext.resume();
}

/** A voice recording in progress. */
export interface Recording {
  /** How loud the microphone is right now, 0 (silence) to 1: proof it's hearing you. */
  level(): number;
  /** Stops and returns the audio. */
  stop(): Promise<Blob>;
  /** Stops and throws the audio away. */
  cancel(): void;
}

/**
 * Starts recording from the microphone. Must be called from a tap, so the
 * phone can ask for permission. iPhone records audio/mp4, others webm.
 */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
  recorder.start();

  // A level meter: an AnalyserNode listens to the same stream.
  unlockAudio(); // a no-op if the tap already did it
  const audio = audioContext!;
  const analyser = audio.createAnalyser();
  analyser.fftSize = 512;
  const source = audio.createMediaStreamSource(stream);
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  const release = () => {
    stream.getTracks().forEach((track) => track.stop());
    source.disconnect(); // the context itself is kept for the next recording
  };

  return {
    level: () => {
      analyser.getFloatTimeDomainData(samples);
      // Root mean square of the waveform, scaled so speech fills most of the bar.
      const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
      return Math.min(1, rms * 4);
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            release();
            resolve(new Blob(chunks, { type: recorder.mimeType || type || 'audio/mp4' }));
          },
          { once: true },
        );
        recorder.stop();
      }),
    cancel: () => {
      recorder.stop();
      release();
    },
  };
}

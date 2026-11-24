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

/** A voice recording in progress. */
export interface Recording {
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

  const release = () => stream.getTracks().forEach((track) => track.stop());

  return {
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

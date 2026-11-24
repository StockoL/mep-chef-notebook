import { useEffect, useState } from 'preact/hooks';

/**
 * The undo bar (UX → Empty states and undo): deleting shows a short message
 * with Undo instead of asking "are you sure?". Also used for quick
 * confirmations ("Saved to inbox"). Any screen calls showMessage(); the one
 * <UndoBar /> in the app shell shows it.
 */

interface Message {
  id: number;
  text: string;
  undo?: () => void | Promise<void>;
}

const SHOW_FOR_MS = 5000;
let nextId = 1;
const listeners = new Set<(message: Message | null) => void>();

export function showMessage(text: string, undo?: Message['undo']) {
  const message = { id: nextId++, text, undo };
  listeners.forEach((listener) => listener(message));
}

export function UndoBar() {
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    listeners.add(setMessage);
    return () => void listeners.delete(setMessage);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  async function undo() {
    setMessage(null);
    await message?.undo?.();
  }

  return (
    <div class="undo-bar" role="status">
      <span class="undo-bar__text">{message.text}</span>
      {message.undo && (
        <button class="undo-bar__undo" type="button" onClick={undo}>
          Undo
        </button>
      )}
    </div>
  );
}

import { useLocation } from 'preact-iso';
import { useEffect, useState } from 'preact/hooks';

/**
 * The undo bar (UX → Empty states and undo): deleting shows a short message
 * with Undo instead of asking "are you sure?". Also says where something went,
 * with a View button to go there ("Moved to kitchen notes · View").
 * Any screen calls showMessage(); the one <UndoBar /> in the app shell shows it.
 */

interface MessageOptions {
  undo?: () => void | Promise<void>;
  /** A link to where the thing now is. */
  view?: { label?: string; href: string };
}

interface Message extends MessageOptions {
  id: number;
  text: string;
}

const SHOW_FOR_MS = 6000;
let nextId = 1;
const listeners = new Set<(message: Message | null) => void>();

export function showMessage(text: string, options: MessageOptions | MessageOptions['undo'] = {}) {
  const resolved = typeof options === 'function' ? { undo: options } : options;
  const message = { id: nextId++, text, ...resolved };
  listeners.forEach((listener) => listener(message));
}

export function UndoBar() {
  const [message, setMessage] = useState<Message | null>(null);
  const location = useLocation();

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

  function view() {
    setMessage(null);
    if (message?.view) location.route(message.view.href);
  }

  return (
    <div class="undo-bar" role="status">
      <span class="undo-bar__text">{message.text}</span>
      <span class="undo-bar__actions">
        {message.view && (
          <button class="undo-bar__undo" type="button" onClick={view}>
            {message.view.label ?? 'View'}
          </button>
        )}
        {message.undo && (
          <button class="undo-bar__undo" type="button" onClick={undo}>
            Undo
          </button>
        )}
      </span>
    </div>
  );
}

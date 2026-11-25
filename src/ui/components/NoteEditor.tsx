import { useState } from 'preact/hooks';
import { updateNoteBody } from '../../data/notes';
import type { Note } from '../../data/types';
import { formatWhen } from '../format';
import { trackSave } from '../saveStatus';
import { MediaView } from './MediaView';

/**
 * A note's text (editable, saved as you type), its photo or voice note, and
 * when it was captured. Used wherever a note opens: inbox, kitchen notes,
 * a component's notes.
 */
export function NoteEditor({ note }: { note: Note }) {
  const [text, setText] = useState(note.body);
  const id = `note-${note.id}`;

  return (
    <div class="flow">
      {note.mediaIds.map((mediaId) => (
        <MediaView key={mediaId} id={mediaId} />
      ))}
      <div class="field">
        <label class="label" for={id}>
          {note.mediaIds.length ? 'Caption' : 'Note'}
        </label>
        <textarea
          id={id}
          class="textarea"
          rows={Math.min(8, Math.max(3, text.split('\n').length + 1))}
          value={text}
          placeholder={note.mediaIds.length ? 'Add a few words about it' : ''}
          onInput={(e) => {
            setText(e.currentTarget.value);
            void trackSave(updateNoteBody(note.id, e.currentTarget.value));
          }}
        />
        <p class="field__hint">Captured {formatWhen(note.createdAt)}.</p>
      </div>
    </div>
  );
}

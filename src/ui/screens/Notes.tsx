import { useLocation } from 'preact-iso';
import { useState } from 'preact/hooks';
import { getPlace, listKitchens } from '../../data/kitchens';
import { deleteNote, getNote, listKitchenNotes, restoreNote, returnToInbox } from '../../data/notes';
import { NO_KITCHEN_ID } from '../../data/types';
import { ChipChoice } from '../components/Controls';
import { MediaView } from '../components/MediaView';
import { NoteEditor } from '../components/NoteEditor';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { showMessage } from '../components/UndoBar';
import { formatWhen } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { paths } from '../router';

/**
 * Kitchen notes: what's been sorted into each kitchen from the inbox
 * ("walk-in door sticks", "three-sided quenelles here"). Opens on the current
 * kitchen; /notes?kitchen=<id> opens on another.
 */
export function Notes() {
  const { query } = useLocation();
  const kitchens = useLiveQuery(() => listKitchens());
  const place = useLiveQuery(() => getPlace());
  const [chosen, setChosen] = useState<string | null>(query.kitchen ?? null);
  const realKitchens = kitchens?.filter((k) => !k.builtIn) ?? [];
  const kitchenId = chosen ?? (place?.kitchenId !== NO_KITCHEN_ID ? place?.kitchenId : realKitchens[0]?.id) ?? null;
  const notes = useLiveQuery(async () => (kitchenId ? listKitchenNotes(kitchenId) : []), [kitchenId]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = useLiveQuery(async () => (openId ? getNote(openId) : undefined), [openId]);

  return (
    <section class="flow">
      <ScreenHeader title="Kitchen notes" back={{ href: paths.today, label: 'Today' }} />

      {realKitchens.length > 1 && (
        <ChipChoice
          label="Kitchen"
          choices={realKitchens.map((k) => ({ value: k.id, label: k.archived ? `${k.name} (archived)` : k.name }))}
          value={kitchenId}
          onChange={(id) => id && setChosen(id)}
        />
      )}

      {realKitchens.length === 0 && (
        <div class="empty-state">
          <p>Kitchen notes belong to a kitchen. Add one from the top bar, then sort notes into it from the inbox.</p>
        </div>
      )}
      {realKitchens.length > 0 && notes?.length === 0 && (
        <div class="empty-state flow">
          <p>No notes for this kitchen yet.</p>
          <p class="empty-state__hint">In the inbox, tap a note, then “Kitchen note”.</p>
        </div>
      )}

      <ul class="row-list" role="list">
        {notes?.map((note) => (
          <li key={note.id}>
            <button class="list-row" type="button" onClick={() => setOpenId(note.id)}>
              <span class="list-row__main">
                {note.body && <span class="list-row__title note-text">{note.body}</span>}
                {note.mediaIds.map((id) => (
                  <MediaView key={id} id={id} compact />
                ))}
                <span class="list-row__meta">{formatWhen(note.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title="Kitchen note">
        {open && (
          <>
            <NoteEditor key={open.id} note={open} />
            <button
              class="button"
              type="button"
              onClick={async () => {
                await returnToInbox(open.id);
                setOpenId(null);
                showMessage('Moved back to the inbox.', { view: { href: paths.inbox } });
              }}
            >
              Move back to inbox
            </button>
            <button
              class="button"
              type="button"
              data-variant="danger"
              onClick={async () => {
                const deleted = await deleteNote(open.id);
                setOpenId(null);
                if (deleted) showMessage('Note deleted.', () => restoreNote(deleted));
              }}
            >
              Delete
            </button>
          </>
        )}
      </Sheet>
    </section>
  );
}

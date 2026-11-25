import { useState } from 'preact/hooks';
import { listKitchens, listSections } from '../../data/kitchens';
import { ListError } from '../../data/lists';
import { createTechnique, sortToTechnique } from '../../data/techniques';
import { TechniquePicker } from '../components/Techniques';
import { deleteNote, listInbox, restoreNote, returnToInbox, sortToKitchenNote, sortToNewComponent } from '../../data/notes';
import { NO_KITCHEN_ID, type Note } from '../../data/types';
import { MediaView } from '../components/MediaView';
import { NoteEditor } from '../components/NoteEditor';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { showMessage } from '../components/UndoBar';
import { formatWhen } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { paths } from '../router';

/**
 * The inbox (C3, UX → Inbox): captures newest first, each with where and
 * when. Tap one to sort it. Common path: tap a note → Kitchen note (2 taps).
 * (UX describes swipe right to sort and left to delete; for now both are
 * buttons in the note's sheet. Delete still offers Undo.)
 */
export function Inbox() {
  const notes = useLiveQuery(() => listInbox());
  const places = useLiveQuery(() => placeNames());
  const [sortingId, setSortingId] = useState<string | null>(null);
  const sorting = notes?.find((n) => n.id === sortingId);

  return (
    <section class="flow">
      <ScreenHeader title="Inbox" back={{ href: paths.today, label: 'Today' }} />
      {notes && notes.length === 0 && (
        <div class="empty-state flow">
          <p>Nothing to sort.</p>
          <p class="empty-state__hint">Notes, photos and voice notes from the capture bar land here.</p>
        </div>
      )}
      <ul class="row-list" role="list">
        {notes?.map((note) => (
          <li key={note.id}>
            <button class="list-row" type="button" onClick={() => setSortingId(note.id)}>
              <span class="list-row__main">
                {note.body && <span class="list-row__title note-text">{note.body}</span>}
                {note.mediaIds.map((id) => (
                  <MediaView key={id} id={id} compact />
                ))}
                <span class="list-row__meta">
                  {[formatWhen(note.createdAt), places && placeLabel(note, places)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={!!sorting} onClose={() => setSortingId(null)} title="Sort this note">
        {sorting && <SortNote key={sorting.id} note={sorting} onDone={() => setSortingId(null)} />}
      </Sheet>
    </section>
  );
}

function SortNote({ note, onDone }: { note: Note; onDone: () => void }) {
  const [naming, setNaming] = useState(false);
  const [toTechnique, setToTechnique] = useState(false);
  const firstLine = note.body.split('\n')[0]?.slice(0, 60) ?? '';
  const [name, setName] = useState(firstLine);
  const [error, setError] = useState('');
  const hasKitchen = note.kitchenId !== NO_KITCHEN_ID;

  async function toKitchen() {
    await sortToKitchenNote(note.id);
    onDone();
    showMessage('Moved to kitchen notes.', {
      view: { href: paths.notesFor(note.kitchenId) },
      undo: () => returnToInbox(note.id),
    });
  }

  async function toComponent(event: Event) {
    event.preventDefault();
    try {
      await sortToNewComponent(note.id, name);
      onDone();
      showMessage(`Added “${name.trim()}” to the Library as a draft.`, { view: { href: paths.library } });
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t create that.');
    }
  }

  async function sortIntoTechnique(technique: { id: string } | { name: string }) {
    const id = 'id' in technique ? technique.id : await createTechnique(technique.name);
    await sortToTechnique(note.id, id);
    onDone();
    showMessage('Added to the technique’s notes.', { view: { href: paths.technique(id) }, undo: () => returnToInbox(note.id) });
  }

  async function remove() {
    const deleted = await deleteNote(note.id);
    onDone();
    if (deleted) showMessage('Note deleted.', () => restoreNote(deleted));
  }

  return (
    <>
      <NoteEditor note={note} />

      <button class="button" type="button" data-variant="primary" disabled={!hasKitchen} onClick={toKitchen}>
        Kitchen note
      </button>
      {!hasKitchen && <p class="field__hint">Captured with no kitchen, so it can’t be a kitchen note.</p>}

      {naming ? (
        <form class="field" onSubmit={toComponent}>
          <label class="label" for="component-name">
            Component name
          </label>
          <div class="input-group">
            <input
              class="input"
              id="component-name"
              value={name}
              autocomplete="off"
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <button class="button" type="submit" disabled={!name.trim()}>
              Create
            </button>
          </div>
          {error && <p class="field__error">{error}</p>}
          <p class="field__hint">Saved as a draft. The note stays with it.</p>
        </form>
      ) : (
        <button class="button" type="button" onClick={() => setNaming(true)}>
          New draft component
        </button>
      )}

      {toTechnique ? (
        <TechniquePicker onPick={sortIntoTechnique} />
      ) : (
        <button class="button" type="button" onClick={() => setToTechnique(true)}>
          A technique’s notes
        </button>
      )}

      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Delete
      </button>
    </>
  );
}

/** Kitchen and section names by id, for labelling notes. */
async function placeNames() {
  const kitchens = await listKitchens();
  const sections = new Map<string, string>();
  for (const kitchen of kitchens) {
    for (const section of await listSections(kitchen.id)) sections.set(section.id, section.name);
  }
  return { kitchens: new Map(kitchens.map((k) => [k.id, k.name])), sections };
}

/** "Dumbleton Hall · Fish" for a note. */
function placeLabel(note: Note, names: Awaited<ReturnType<typeof placeNames>>): string {
  return [names.kitchens.get(note.kitchenId), note.sectionId ? names.sections.get(note.sectionId) : undefined]
    .filter(Boolean)
    .join(' · ');
}

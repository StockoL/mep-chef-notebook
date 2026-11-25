import { useState } from 'preact/hooks';
import { listComponents } from '../../data/components';
import { listComponentNotes } from '../../data/notes';
import { NoteEditor } from '../components/NoteEditor';
import { Sheet } from '../components/Sheet';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';

/**
 * Library tab. Phase 2 builds the cookbook (dishes, components, ingredients,
 * techniques, search). For now it lists the draft components made from
 * inbox notes; tapping one shows the notes sorted into it, so nothing sorted
 * there goes missing.
 */
export function Library() {
  const components = useLiveQuery(() => listComponents());
  const [openId, setOpenId] = useState<string | null>(null);
  const open = components?.find((c) => c.id === openId);
  const notes = useLiveQuery(async () => (openId ? listComponentNotes(openId) : []), [openId]);

  return (
    <section class="flow">
      <h1>Library</h1>
      {components?.length === 0 ? (
        <div class="empty-state flow">
          <p>Your dishes, components, ingredients and techniques will live here.</p>
          <p class="empty-state__hint">In the inbox, tap a note, then “New draft component” to start.</p>
        </div>
      ) : (
        <>
          <h2>Components</h2>
          <ul class="row-list" role="list">
            {components?.map((component) => (
              <li key={component.id}>
                <button class="list-row" type="button" onClick={() => setOpenId(component.id)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{component.name}</span>
                    <span class="list-row__meta">Draft</span>
                  </span>
                  <Icon name="chevron-right" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''}>
        <p class="field__hint">A draft. Ingredients and method can be added soon.</p>
        <h3>Notes</h3>
        {notes?.length === 0 && <p class="field__hint">No notes yet.</p>}
        {notes?.map((note) => (
          <div key={note.id} class="card">
            <div class="card__body">
              <NoteEditor note={note} />
            </div>
          </div>
        ))}
      </Sheet>
    </section>
  );
}

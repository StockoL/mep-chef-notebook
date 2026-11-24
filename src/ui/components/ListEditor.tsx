import { useState } from 'preact/hooks';
import type { ListItem } from '../../core/lists/lists';
import {
  addListItem,
  getListItems,
  ListError,
  mergeListItem,
  moveListItem,
  renameListItem,
  setListItemHidden,
  type ListRef,
} from '../../data/lists';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { ChipChoice } from './Controls';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

interface ListEditorProps {
  listRef: ListRef;
  /** Singular, lower case: "section", "waste reason". */
  itemName: string;
  /** Marks one item as the chef's usual (sections). */
  usual?: { id: Id | null; set: (id: Id | null) => void };
  /** An extra link in an item's sheet, e.g. a service's times. */
  detailLink?: (item: ListItem) => { href: string; label: string };
}

type Id = string;

/**
 * The one editor every editable list uses (UX → Editable lists, F2): tap an
 * item to rename, move, hide or merge it; add at the bottom.
 * (UX also describes drag-to-reorder and swipe-to-hide; here they're buttons
 * in the item's sheet, which work one-handed with wet fingers.)
 */
export function ListEditor({ listRef, itemName, usual, detailLink }: ListEditorProps) {
  const items = useLiveQuery(() => getListItems(listRef), [JSON.stringify(listRef)]);
  const [editingId, setEditingId] = useState<Id | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  if (!items) return null;
  const editing = items.find((item) => item.id === editingId);

  async function add(event: Event) {
    event.preventDefault();
    try {
      await addListItem(listRef, newName);
      setNewName('');
      setError('');
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add that.');
    }
  }

  return (
    <div class="flow">
      <ul class="row-list" role="list">
        {items.map((item) => (
          <li key={item.id}>
            <button class="list-row" type="button" onClick={() => setEditingId(item.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{item.name}</span>
                {item.hidden && <span class="list-row__meta">Hidden</span>}
                {usual?.id === item.id && <span class="list-row__meta">Usual</span>}
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>

      <form class="field" onSubmit={add}>
        <label class="label" for={`add-${itemName}`}>
          Add a {itemName}
        </label>
        <div class="input-group">
          <input
            class="input"
            id={`add-${itemName}`}
            value={newName}
            autocomplete="off"
            enterkeyhint="done"
            onInput={(e) => setNewName(e.currentTarget.value)}
          />
          <button class="button" type="submit" disabled={!newName.trim()}>
            Add
          </button>
        </div>
        {error && <p class="field__error">{error}</p>}
      </form>

      <Sheet open={!!editing} onClose={() => setEditingId(null)} title={editing?.name ?? ''}>
        {editing && (
          <ItemSheetBody
            key={editing.id}
            item={editing}
            items={items}
            listRef={listRef}
            itemName={itemName}
            usual={usual}
            detailLink={detailLink?.(editing)}
            onDone={() => setEditingId(null)}
          />
        )}
      </Sheet>
    </div>
  );
}

function ItemSheetBody(props: {
  item: ListItem;
  items: ListItem[];
  listRef: ListRef;
  itemName: string;
  usual?: ListEditorProps['usual'];
  detailLink?: { href: string; label: string };
  onDone: () => void;
}) {
  const { item, items, listRef, itemName, usual, detailLink, onDone } = props;
  const [name, setName] = useState(item.name);
  const [error, setError] = useState('');
  const [merging, setMerging] = useState(false);
  const index = items.findIndex((i) => i.id === item.id);

  // Renames save when the field is left (or Done is tapped on the keyboard).
  async function saveName() {
    if (name.trim() === item.name) return;
    try {
      await renameListItem(listRef, item.id, name);
      setError('');
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t rename that.');
    }
  }

  async function toggleHidden() {
    try {
      await setListItemHidden(listRef, item.id, !item.hidden);
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t change that.');
    }
  }

  async function mergeInto(intoId: Id | null) {
    if (!intoId) return;
    const into = items.find((i) => i.id === intoId);
    await mergeListItem(listRef, item.id, intoId);
    onDone();
    showMessage(`Merged "${item.name}" into "${into?.name}".`);
  }

  return (
    <>
      <div class="field">
        <label class="label" for="list-item-name">
          Name
        </label>
        <input
          class="input"
          id="list-item-name"
          value={name}
          enterkeyhint="done"
          onInput={(e) => setName(e.currentTarget.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {error && <p class="field__error">{error}</p>}
      </div>

      {detailLink && (
        <a class="button" href={detailLink.href} onClick={onDone}>
          {detailLink.label}
        </a>
      )}

      <div class="cluster">
        <button class="button" type="button" disabled={index <= 0} onClick={() => moveListItem(listRef, item.id, -1)}>
          Move up
        </button>
        <button
          class="button"
          type="button"
          disabled={index >= items.length - 1}
          onClick={() => moveListItem(listRef, item.id, 1)}
        >
          Move down
        </button>
      </div>

      <div class="cluster">
        {usual && (
          <button class="button" type="button" onClick={() => usual.set(usual.id === item.id ? null : item.id)}>
            {usual.id === item.id ? `Not my usual ${itemName}` : `Make my usual ${itemName}`}
          </button>
        )}
        <button class="button" type="button" onClick={toggleHidden}>
          {item.hidden ? 'Show' : 'Hide'}
        </button>
        <button class="button" type="button" onClick={() => setMerging(!merging)} aria-expanded={merging}>
          Merge into…
        </button>
      </div>

      {merging && (
        <ChipChoice
          label={`Merge "${item.name}" into`}
          choices={items.filter((i) => i.id !== item.id && !i.hidden).map((i) => ({ value: i.id, label: i.name }))}
          value={null}
          onChange={mergeInto}
        />
      )}
      <p class="field__hint">
        Hiding keeps it on old notes and entries. Merging moves everything to the one you choose.
      </p>
    </>
  );
}

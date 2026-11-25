/**
 * The editing pieces the library pages share: ingredient shorthand, method
 * steps, tags, collections and picking a component.
 */

import { useRef, useState } from 'preact/hooks';
import { findByName } from '../../core/ingredients/names';
import { formatShorthand, parseShorthand } from '../../core/ingredients/shorthand';
import { formatQuantity } from '../../core/units/units';
import { listComponents } from '../../data/components';
import { createComponent, deleteUnusedIngredients, listIngredients, saveLines, type LineView } from '../../data/library';
import { ListError } from '../../data/lists';
import { createCollection, ensureTag, listCollections, listTags, tagNames, toggleInCollection } from '../../data/tags';
import type { CollectionMember, Id, KitchenId } from '../../data/types';
import { useAutosave } from '../hooks/useAutosave';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

// ─── Ingredient lines ─────────────────────────────────────────────────────

/**
 * Ingredients in shorthand (R1, UX → Editing rule 3): type "bones 2kg,
 * mirepoix, tom puree", and tidy rows appear underneath as you type, each
 * saying whether it's a known ingredient, another component, or new.
 * Saved when you leave the box (so half-typed words never become ingredients).
 */
export function LinesEditor({ variationId, componentId, lines }: { variationId: Id; componentId: Id; lines: LineView[] }) {
  const [text, setText] = useState(() =>
    lines.map((l) => formatShorthand({ name: l.name, quantity: l.line.quantity, unit: l.line.unit, prepNote: l.line.prepNote })).join('\n'),
  );
  const [saved, setSaved] = useState(true);
  // Ingredients this box created; any left unused after a save are tidied away.
  const created = useRef(new Set<Id>());
  const ingredients = useLiveQuery(() => listIngredients());
  const components = useLiveQuery(async () => (await listComponents()).filter((c) => c.id !== componentId), [componentId]);
  const parsed = parseShorthand(text);

  const { change, flush } = useAutosave(async (value: string) => {
    const newIds = await saveLines(variationId, parseShorthand(value));
    newIds.forEach((id) => created.current.add(id));
    await deleteUnusedIngredients([...created.current]);
    setSaved(true);
  }, 2000);

  return (
    <div class="flow">
      <label class="label" for="lines">
        Ingredients
      </label>
      <textarea
        id="lines"
        class="textarea"
        rows={Math.max(3, text.split('\n').length + 1)}
        value={text}
        placeholder="bones 2kg, mirepoix, tom puree 1 tbsp, thyme 3 sprigs"
        autocapitalize="none"
        onInput={(e) => {
          setText(e.currentTarget.value);
          setSaved(false);
          change(e.currentTarget.value);
        }}
        onBlur={flush}
      />
      <p class="field__hint">One per line or separated by commas. Saved as you go.</p>
      {parsed.length > 0 && (
        <ul class="line-rows" role="list" aria-label="Ingredients as read">
          {parsed.map((line, index) => {
            const component = components && findByName(components, line.name);
            const ingredient = !component && ingredients ? findByName(ingredients, line.name) : undefined;
            const href = component ? paths.component(component.id) : ingredient ? paths.ingredient(ingredient.id) : undefined;
            const content = (
              <>
                <span class="line-rows__quantity">{line.quantity !== null ? formatQuantity(line.quantity, line.unit ?? 'each') : ''}</span>
                <span class="line-rows__name">
                  {component?.name ?? ingredient?.name ?? line.name}
                  {line.prepNote && <span class="line-rows__note">, {line.prepNote}</span>}
                </span>
                <span class="line-rows__kind">{component ? 'component' : ingredient ? '' : 'new'}</span>
              </>
            );
            return (
              <li key={index}>
                {href && saved ? (
                  <a class="line-rows__row" href={href}>
                    {content}
                  </a>
                ) : (
                  <span class="line-rows__row">{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Tags ─────────────────────────────────────────────────────────────────

/** Tags (R3): tap one to remove it; type to add, with matching tags suggested. */
export function TagEditor({ tagIds, onChange }: { tagIds: Id[]; onChange: (ids: Id[]) => Promise<void> }) {
  const all = useLiveQuery(() => listTags());
  const names = useLiveQuery(() => tagNames());
  const [typed, setTyped] = useState('');

  async function add(name: string) {
    if (!name.trim()) return;
    const id = await ensureTag(name);
    setTyped('');
    if (!tagIds.includes(id)) await trackSave(onChange([...tagIds, id]));
  }

  const suggestions = (all ?? [])
    .filter((t) => !tagIds.includes(t.id) && (!typed || t.name.toLowerCase().includes(typed.trim().toLowerCase())))
    .slice(0, 8);

  return (
    <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <p class="label">Tags</p>
      {tagIds.length > 0 && (
        <div class="cluster" style={{ '--gutter': 'var(--space-2xs)' }}>
          {tagIds.map((id) => (
            <button
              key={id}
              class="chip"
              type="button"
              aria-pressed="true"
              aria-label={`Remove tag ${names?.get(id) ?? ''}`}
              onClick={() => trackSave(onChange(tagIds.filter((t) => t !== id)))}
            >
              {names?.get(id) ?? '…'} ×
            </button>
          ))}
        </div>
      )}
      <form
        class="input-group"
        onSubmit={(e) => {
          e.preventDefault();
          void add(typed);
        }}
      >
        <input
          class="input"
          aria-label="Add a tag"
          value={typed}
          placeholder="staff dinner, canapé…"
          autocomplete="off"
          onInput={(e) => setTyped(e.currentTarget.value)}
        />
        <button class="button" type="submit" disabled={!typed.trim()}>
          Add
        </button>
      </form>
      {suggestions.length > 0 && (
        <div class="cluster" style={{ '--gutter': 'var(--space-2xs)' }}>
          {suggestions.map((t) => (
            <button key={t.id} class="chip" type="button" onClick={() => add(t.name)}>
              + {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Collections ──────────────────────────────────────────────────────────

/** Which of the chef's collections this item is in; tap to add or remove; make a new one. */
export function CollectionToggles({ member }: { member: CollectionMember }) {
  const collections = useLiveQuery(() => listCollections());
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function create(event: Event) {
    event.preventDefault();
    try {
      const id = await createCollection(name);
      await trackSave(toggleInCollection(id, member));
      setName('');
      setError('');
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t create it.');
    }
  }

  return (
    <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <p class="label">Collections</p>
      {collections && collections.length > 0 && (
        <div class="cluster" style={{ '--gutter': 'var(--space-2xs)' }}>
          {collections.map((c) => (
            <button
              key={c.id}
              class="chip"
              type="button"
              aria-pressed={c.members.some((m) => m.kind === member.kind && m.id === member.id)}
              onClick={() => trackSave(toggleInCollection(c.id, member))}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <form class="input-group" onSubmit={create}>
        <input
          class="input"
          aria-label="New collection"
          value={name}
          placeholder="New collection, e.g. Things to master"
          autocomplete="off"
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button class="button" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p class="field__error">{error}</p>}
    </div>
  );
}

// ─── Picking a component ──────────────────────────────────────────────────

/** A sheet to choose a component (or make a new draft one): for adding to a dish. */
export function ComponentPicker(props: {
  open: boolean;
  onClose: () => void;
  onPick: (componentId: Id, name: string) => Promise<void>;
  kitchenId: KitchenId;
  exclude: Id[];
}) {
  const { open, onClose, onPick, kitchenId, exclude } = props;
  const components = useLiveQuery(() => listComponents());
  const [query, setQuery] = useState('');
  const matches = (components ?? []).filter(
    (c) => !exclude.includes(c.id) && c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const exact = (components ?? []).some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  async function pick(id: Id, name: string) {
    await onPick(id, name);
    setQuery('');
    onClose();
  }

  async function createNew() {
    const id = await createComponent(query, kitchenId);
    showMessage(`New draft component: ${query.trim()}.`);
    await pick(id, query.trim());
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a component" position="top">
      <input
        class="input"
        type="search"
        aria-label="Find a component"
        placeholder="Find or name a component"
        value={query}
        autocomplete="off"
        onInput={(e) => setQuery(e.currentTarget.value)}
      />
      {query.trim() && !exact && (
        <button class="button" type="button" data-variant="primary" onClick={createNew}>
          New component “{query.trim()}”
        </button>
      )}
      <ul class="row-list" role="list">
        {matches.map((c) => (
          <li key={c.id}>
            <button class="list-row" type="button" onClick={() => pick(c.id, c.name)}>
              <span class="list-row__main">
                <span class="list-row__title">{c.name}</span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** A comma-separated list of other names (aliases), saved when the field is left. */
export function AliasesField({ aliases, onSave }: { aliases: string[]; onSave: (aliases: string[]) => Promise<void> }) {
  const [text, setText] = useState(aliases.join(', '));
  return (
    <div class="field">
      <label class="label" for="aliases">
        Also called
      </label>
      <input
        class="input"
        id="aliases"
        value={text}
        placeholder="e.g. tom puree, TP"
        autocomplete="off"
        onInput={(e) => setText(e.currentTarget.value)}
        onBlur={() => {
          const next = text.split(',').map((a) => a.trim()).filter(Boolean);
          if (next.join('|') !== aliases.join('|')) void trackSave(onSave(next));
        }}
      />
      <p class="field__hint">Separate with commas. Search and ingredient lists find these too.</p>
    </div>
  );
}

/** A name field that saves when left, with an error if it's emptied. */
export function NameField({ value, onSave }: { value: string; onSave: (name: string) => Promise<void> }) {
  const [text, setText] = useState(value);
  const [error, setError] = useState('');
  return (
    <div class="field">
      <label class="label" for="item-name">
        Name
      </label>
      <input
        class="input"
        id="item-name"
        value={text}
        enterkeyhint="done"
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        onBlur={async () => {
          if (text.trim() === value) return;
          try {
            await trackSave(onSave(text));
            setError('');
          } catch (e) {
            setError(e instanceof ListError ? e.message : 'Couldn’t rename it.');
          }
        }}
      />
      {error && <p class="field__error">{error}</p>}
    </div>
  );
}

/** A longer text (description, plating spec) saved as you type. */
export function TextAreaField(props: { id: string; label: string; value: string; placeholder?: string; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState(props.value);
  const { change, flush } = useAutosave(props.onSave, 800);
  return (
    <div class="field">
      <label class="label" for={props.id}>
        {props.label}
      </label>
      <textarea
        id={props.id}
        class="textarea"
        rows={3}
        value={text}
        placeholder={props.placeholder}
        onInput={(e) => {
          setText(e.currentTarget.value);
          change(e.currentTarget.value);
        }}
        onBlur={flush}
      />
    </div>
  );
}

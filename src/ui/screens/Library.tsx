import { useLocation } from 'preact-iso';
import { useEffect, useRef, useState } from 'preact/hooks';
import { getPlace } from '../../data/kitchens';
import { createComponent, createDish, createIngredient, listComponentSummaries, listDishSummaries, listIngredients } from '../../data/library';
import { getListItems, ListError } from '../../data/lists';
import { getMenuView, listMenus } from '../../data/menus';
import { listRecent, searchLibrary } from '../../data/search';
import { listCollections, listTags } from '../../data/tags';
import { createTechnique, hasOwnNotes, listTechniques } from '../../data/techniques';
import type { Collection } from '../../data/types';
import { ChipChoice, Segmented } from '../components/Controls';
import { Sheet } from '../components/Sheet';
import { formatWhen } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { MenuCourses, menuLabel, SectionFilter } from './Menus';

type Lens = 'dishes' | 'components' | 'ingredients' | 'techniques';
const LENSES: { value: Lens; label: string }[] = [
  { value: 'dishes', label: 'Dishes' },
  { value: 'components', label: 'Components' },
  { value: 'ingredients', label: 'Ingredients' },
  { value: 'techniques', label: 'Techniques' },
];
const LENS_KEY = 'mep.libraryLens';

/**
 * The library (R7, R2, UX → Navigation → Library): one search box, recently
 * opened items, and four ways in. Finding something: Library → tap it in
 * Recent or its lens (2 taps), or Library → search → tap a result (3).
 */
export function Library() {
  const { query, route } = useLocation();
  const [search, setSearch] = useState('');
  const [lens, setLensState] = useState<Lens>(() => (sessionStorage.getItem(LENS_KEY) as Lens | null) ?? 'components');
  const [creating, setCreating] = useState(false);
  const searchField = useRef<HTMLInputElement>(null);

  // The top bar's search button opens the library with the box focused.
  useEffect(() => {
    if (query.search) searchField.current?.focus();
  }, [query.search]);

  function setLens(next: Lens) {
    sessionStorage.setItem(LENS_KEY, next);
    setLensState(next);
  }

  return (
    <section class="flow">
      <div class="library-head">
        <h1>Library</h1>
        <button class="button" type="button" data-variant="primary" onClick={() => setCreating(true)}>
          + New
        </button>
      </div>

      <input
        ref={searchField}
        class="input"
        type="search"
        enterkeyhint="search"
        aria-label="Search the library"
        placeholder="Search dishes, components, ingredients, notes"
        value={search}
        autocomplete="off"
        onInput={(e) => setSearch(e.currentTarget.value)}
      />

      {search.trim() ? (
        <SearchResults query={search} />
      ) : (
        <>
          <Recent />
          {/* Chips on one row that scrolls: four long labels don't fit across a phone. */}
          <div class="reel" role="region" aria-label="Show" tabIndex={0}>
            {LENSES.map((choice) => (
              <button key={choice.value} class="chip" type="button" aria-pressed={lens === choice.value} onClick={() => setLens(choice.value)}>
                {choice.label}
              </button>
            ))}
          </div>
          {lens === 'dishes' && <DishesLens />}
          {lens === 'components' && <ComponentsLens />}
          {lens === 'ingredients' && <IngredientsLens />}
          {lens === 'techniques' && <TechniquesLens />}
        </>
      )}

      <NewItemSheet
        open={creating}
        onClose={() => setCreating(false)}
        initialKind={lens === 'dishes' ? 'dish' : lens === 'ingredients' ? 'ingredient' : lens === 'techniques' ? 'technique' : 'component'}
        initialName={search}
        onCreated={(href) => {
          setCreating(false);
          route(href);
        }}
      />
    </section>
  );
}

// ─── Lenses ───────────────────────────────────────────────────────────────

function Recent() {
  const recent = useLiveQuery(() => listRecent());
  if (!recent?.length) return null;
  const href = { dish: paths.dish, component: paths.component, ingredient: paths.ingredient };
  return (
    <section class="flow" aria-labelledby="recent" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <h2 id="recent" class="used-in__label">
        Recent
      </h2>
      <div class="reel" role="region" aria-label="Recent" tabIndex={0}>
        {recent.map((item) => (
          <a key={`${item.kind}-${item.id}`} class="chip" href={href[item.kind](item.id)}>
            {item.name}
          </a>
        ))}
      </div>
    </section>
  );
}

/** Tag and collection filters, shared by dishes and components. */
function useFilters(kind: 'dish' | 'component') {
  const tags = useLiveQuery(() => listTags());
  const collections = useLiveQuery(() => listCollections());
  const [tagId, setTagId] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const collection = collections?.find((c) => c.id === collectionId);

  const matches = (item: { id: string; tagIds: string[] }) =>
    (!tagId || item.tagIds.includes(tagId)) && (!collection || inCollection(collection, kind, item.id));

  const controls = (
    <>
      {tags && tags.length > 0 && (
        <ChipChoice label="Tag" choices={tags.map((t) => ({ value: t.id, label: t.name }))} value={tagId} onChange={setTagId} allowNone reel />
      )}
      {collections && collections.length > 0 && (
        <ChipChoice
          label="Collection"
          choices={collections.map((c) => ({ value: c.id, label: c.name }))}
          value={collectionId}
          onChange={setCollectionId}
          allowNone
          reel
        />
      )}
    </>
  );
  return { matches, controls };
}

function inCollection(collection: Collection, kind: 'dish' | 'component', id: string) {
  return collection.members.some((m) => m.kind === kind && m.id === id);
}

/**
 * Dishes by menu and course (R7, UX → Library): the menus on now and coming
 * up as chips at the top, then "All dishes" for everything else.
 */
function DishesLens() {
  const dishes = useLiveQuery(() => listDishSummaries());
  const place = useLiveQuery(() => getPlace());
  const menus = useLiveQuery(async () => (place ? (await listMenus(place.kitchenId)).filter((m) => m.status !== 'past') : []), [place?.kitchenId]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const menuId = chosen ?? menus?.[0]?.id ?? 'all';
  const view = useLiveQuery(async () => (menuId !== 'all' ? getMenuView(menuId, []) : undefined), [menuId]);
  const { matches, controls } = useFilters('dish');
  if (!dishes || !menus) return null;

  const menuChips = (
    <div class="reel" role="region" aria-label="Menu" tabIndex={0}>
      {menus.map((m) => (
        <button key={m.id} class="chip" type="button" aria-pressed={menuId === m.id} onClick={() => setChosen(m.id)}>
          {menuLabel(m)}
        </button>
      ))}
      <button class="chip" type="button" aria-pressed={menuId === 'all'} onClick={() => setChosen('all')}>
        All dishes
      </button>
      <a class="chip" href={paths.menus}>
        Menus…
      </a>
    </div>
  );

  if (menuId !== 'all') {
    return (
      <>
        {menuChips}
        {view && <SectionFilter kitchenId={view.menu.kitchenId} value={sectionId} onChange={setSectionId} />}
        {view && <MenuCourses view={view} sectionId={sectionId} />}
        {view && (
          <a class="button" href={paths.menu(view.menu.id)}>
            Edit {view.menu.name}
          </a>
        )}
      </>
    );
  }
  if (dishes.length === 0) {
    return (
      <>
        {menuChips}
        <Empty text="No dishes yet. A dish is anything served, made of components. Tap + New." />
      </>
    );
  }
  const shown = dishes.filter(({ dish }) => matches(dish));
  return (
    <>
      {menuChips}
      {controls}
      <RowList
        rows={shown.map(({ dish, componentCount }) => ({
          href: paths.dish(dish.id),
          title: dish.name,
          meta: componentCount === 1 ? '1 component' : `${componentCount} components`,
        }))}
      />
    </>
  );
}

/** Components grouped by type (the chef's own list), expandable in place. */
function ComponentsLens() {
  const place = useLiveQuery(() => getPlace());
  const kitchenId = place?.kitchenId;
  const summaries = useLiveQuery(async () => (kitchenId ? listComponentSummaries(kitchenId) : undefined), [kitchenId]);
  const types = useLiveQuery(() => getListItems({ kind: 'values', list: 'component-types', kitchenId: null }));
  const { matches, controls } = useFilters('component');
  if (!summaries || !types) return null;
  if (summaries.length === 0) return <Empty text="No components yet. A component is a recipe for one part: a stock, a sauce, a garnish. Tap + New." />;

  const shown = summaries.filter(({ component }) => matches(component));
  const knownType = (typeId: string | null) => typeId !== null && types.some((t) => t.id === typeId);
  const groups = [
    ...types.map((t) => ({ key: t.id, name: t.name, items: shown.filter((s) => s.component.typeId === t.id) })),
    { key: 'none', name: 'No type yet', items: shown.filter((s) => !knownType(s.component.typeId)) },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      {controls}
      {groups.map((group) => (
        <details key={group.key} class="library-group" open>
          <summary class="library-group__summary">
            {group.name} <span class="list-row__meta">{group.items.length}</span>
          </summary>
          <RowList
            rows={group.items.map(({ component, dishCount, status }) => ({
              href: paths.component(component.id),
              title: component.name,
              meta: [status === 'draft' ? 'Draft' : 'Ready', dishCount ? `in ${dishCount} ${dishCount === 1 ? 'dish' : 'dishes'}` : '']
                .filter(Boolean)
                .join(' · '),
            }))}
          />
        </details>
      ))}
    </>
  );
}

/** Ingredients A–Z. */
function IngredientsLens() {
  const ingredients = useLiveQuery(() => listIngredients());
  if (!ingredients) return null;
  if (ingredients.length === 0) return <Empty text="Ingredients appear here as you write components. Look one up to see everything that uses it." />;
  const byLetter = new Map<string, typeof ingredients>();
  for (const ingredient of ingredients) {
    const letter = ingredient.name.charAt(0).toUpperCase();
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), ingredient]);
  }
  return (
    <>
      {[...byLetter].map(([letter, items]) => (
        <section key={letter} class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
          <h2 class="used-in__label">{letter}</h2>
          <RowList rows={items.map((i) => ({ href: paths.ingredient(i.id), title: i.name, meta: i.aliases.join(', ') }))} />
        </section>
      ))}
    </>
  );
}

/**
 * Techniques grouped by category (UX → Library): filled ones have your own
 * notes; outlined ones are a name only, waiting for them.
 */
function TechniquesLens() {
  const techniques = useLiveQuery(() => listTechniques());
  const categories = useLiveQuery(() => getListItems({ kind: 'values', list: 'technique-categories', kitchenId: null }));
  if (!techniques || !categories) return null;
  if (techniques.length === 0) return <Empty text="No techniques yet. Tap + New to add one." />;
  const known = (id: string | null) => id !== null && categories.some((c) => c.id === id);
  const groups = [
    ...categories.map((c) => ({ key: c.id, name: c.name, items: techniques.filter((t) => t.categoryId === c.id) })),
    { key: 'none', name: 'No category yet', items: techniques.filter((t) => !known(t.categoryId)) },
  ].filter((g) => g.items.length > 0);
  return (
    <>
      <p class="field__hint">Filled: your own notes. Outlined: a name, waiting for your notes.</p>
      {groups.map((group) => (
        <details key={group.key} class="library-group" open>
          <summary class="library-group__summary">
            {group.name} <span class="list-row__meta">{group.items.length}</span>
          </summary>
          <div class="cluster" style={{ '--gutter': 'var(--space-2xs)' }}>
            {group.items.map((t) => (
              <a key={t.id} class="chip" href={paths.technique(t.id)} data-filled={hasOwnNotes(t)}>
                {t.name}
              </a>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}

// ─── Search ───────────────────────────────────────────────────────────────

function SearchResults({ query }: { query: string }) {
  const results = useLiveQuery(() => searchLibrary(query), [query]);
  if (!results) return null;
  const groups = [
    { label: 'Dishes', rows: results.dishes.map((d) => ({ href: paths.dish(d.id), title: d.name })) },
    { label: 'Components', rows: results.components.map((c) => ({ href: paths.component(c.id), title: c.name, meta: c.aliases.join(', ') })) },
    { label: 'Ingredients', rows: results.ingredients.map((i) => ({ href: paths.ingredient(i.id), title: i.name, meta: i.aliases.join(', ') })) },
    { label: 'Techniques', rows: results.techniques.map((t) => ({ href: paths.technique(t.id), title: t.name, meta: t.aliases.join(', ') })) },
    {
      label: 'Notes',
      rows: results.notes.map((n) => {
        const component = n.links.find((l) => l.kind === 'component');
        const technique = n.links.find((l) => l.kind === 'technique');
        return {
          href: component ? paths.component(component.id) : technique ? paths.technique(technique.id) : paths.notesFor(n.kitchenId),
          title: n.body,
          meta: `${component ? 'Component note' : technique ? 'Technique note' : 'Kitchen note'} · ${formatWhen(n.createdAt)}`,
        };
      }),
    },
  ].filter((g) => g.rows.length > 0);

  if (groups.length === 0) return <Empty text={`Nothing matches “${query.trim()}”. Tap + New to add it.`} />;
  return (
    <>
      {groups.map((group) => (
        <section key={group.label} class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
          <h2 class="used-in__label">{group.label}</h2>
          <RowList rows={group.rows} />
        </section>
      ))}
    </>
  );
}

// ─── New item ─────────────────────────────────────────────────────────────

type NewKind = 'component' | 'dish' | 'ingredient' | 'technique';

interface NewItemProps {
  open: boolean;
  onClose: () => void;
  initialKind: NewKind;
  initialName: string;
  onCreated: (href: string) => void;
}

function NewItemSheet(props: NewItemProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="New" position="top">
      <NewItemForm key={`${props.initialKind}-${props.initialName}`} {...props} />
    </Sheet>
  );
}

function NewItemForm({ initialKind, initialName, onCreated }: NewItemProps) {
  const [kind, setKind] = useState<NewKind>(initialKind);
  const [name, setName] = useState(initialName.trim());
  const [error, setError] = useState('');
  const place = useLiveQuery(() => getPlace());

  async function submit(event: Event) {
    event.preventDefault();
    try {
      if (kind === 'component') onCreated(paths.component(await createComponent(name, place!.kitchenId)));
      if (kind === 'dish') onCreated(paths.dish(await createDish(name)));
      if (kind === 'ingredient') onCreated(paths.ingredient(await createIngredient(name)));
      if (kind === 'technique') onCreated(paths.technique(await createTechnique(name)));
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t create it.');
    }
  }

  return (
    <form class="flow" onSubmit={submit}>
      <Segmented
        label="Kind"
        choices={[
          { value: 'component', label: 'Component' },
          { value: 'dish', label: 'Dish' },
          { value: 'ingredient', label: 'Ingredient' },
          { value: 'technique', label: 'Technique' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <div class="field">
        <label class="label" for="new-name">
          Name
        </label>
        <input class="input" id="new-name" value={name} autocomplete="off" onInput={(e) => setName(e.currentTarget.value)} />
        {error && <p class="field__error">{error}</p>}
      </div>
      <button class="button" type="submit" data-variant="primary" disabled={!name.trim() || !place}>
        Create
      </button>
      <p class="field__hint">
        {kind === 'component' && 'A recipe for one part: a stock, a sauce, a garnish. Starts as a draft.'}
        {kind === 'dish' && 'Anything served, made of components.'}
        {kind === 'ingredient' && 'Something you don’t make. Usually added for you as you write components.'}
        {kind === 'technique' && 'A way of doing something: quenelle, brunoise, beurre blanc. Your notes, in your words.'}
      </p>
    </form>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────

function RowList({ rows }: { rows: { href: string; title: string; meta?: string }[] }) {
  return (
    <ul class="row-list" role="list">
      {rows.map((row) => (
        <li key={row.href + row.title}>
          <a class="list-row" href={row.href}>
            <span class="list-row__main">
              <span class="list-row__title note-text">{row.title}</span>
              {row.meta && <span class="list-row__meta">{row.meta}</span>}
            </span>
            <Icon name="chevron-right" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div class="empty-state">
      <p>{text}</p>
    </div>
  );
}

import { useLocation } from 'preact-iso';
import { useEffect, useRef, useState } from 'preact/hooks';
import { componentOrigins, findSuffixedNames, MINE, originChoices, tidySuffixedNames, type Origin } from '../../data/dishOrigin';
import { restoreSnapshot } from '../../data/snapshot';
import { showMessage } from '../components/UndoBar';
import { trackSave } from '../saveStatus';
import { getPlace, listKitchens } from '../../data/kitchens';
import { getSetting, setSetting } from '../../data/settings';
import { createComponent, createDish, createIngredient, listComponentSummaries, listDishSummaries, listIngredients } from '../../data/library';
import { getListItems, ListError } from '../../data/lists';
import { getMenuView, listMenus } from '../../data/menus';
import { listRecent, searchLibrary } from '../../data/search';
import { listCollections, listTags } from '../../data/tags';
import { createTechnique, hasOwnNotes, listTechniques } from '../../data/techniques';
import type { Collection, Dish, Menu } from '../../data/types';
import { ChipChoice, Segmented } from '../components/Controls';
import { Sheet } from '../components/Sheet';
import { formatWhen } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { MenuCourses, SectionFilter, useServiceNames } from './Menus';
import { servedAt, servedLabel } from '../../core/menus/served';
import { isoDayOfWeek } from '../../core/time/calendar';
import { Hint } from '../components/Hint';

type Lens = 'dishes' | 'components' | 'ingredients' | 'techniques';
const LENSES: { value: Lens; label: string }[] = [
  { value: 'dishes', label: 'Dishes' },
  { value: 'components', label: 'Components' },
  { value: 'ingredients', label: 'Ingredients' },
  { value: 'techniques', label: 'Techniques' },
];
const LENS_KEY = 'mep.libraryLens';
const ORIGIN_KEY = 'mep.libraryOrigin';
/** The menu last looked at in the Dishes lens (a setting, so it's there next time). */
const MENU_KEY = 'library.menu';

/**
 * The library (R7, R2, UX → Navigation → Library): one search box, recently
 * opened items, and four ways in. Finding something: Library → tap it in
 * Recent or its lens (2 taps), or Library → search → tap a result (3).
 */
export function Library() {
  const { query, route } = useLocation();
  const [search, setSearch] = useState('');
  const [lens, setLensState] = useState<Lens>(() => (sessionStorage.getItem(LENS_KEY) as Lens | null) ?? 'dishes');
  // Recent shows while the search box is in use (FEEL_PASS 6): one less row of chips on the page.
  const [searching, setSearching] = useState(false);
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
        placeholder="Search"
        value={search}
        autocomplete="off"
        onInput={(e) => setSearch(e.currentTarget.value)}
        onFocus={() => setSearching(true)}
        // Late enough for a tap on a Recent chip to land first.
        onBlur={() => setTimeout(() => setSearching(false), 200)}
      />

      {search.trim() ? (
        <SearchResults query={search} />
      ) : (
        <>
          {searching && <Recent />}
          <TidyNames />
          <div class="library-lens">
            <Segmented label="Show" choices={LENSES} value={lens} onChange={setLens} />
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

/**
 * A one-off offer (DECISIONS 54): names written with where they're from,
 * "Cornish sea bass (Dumbleton, 2026)", tidied to "Cornish sea bass" with
 * the kitchen recorded instead. Shows only while there are such names.
 */
function TidyNames() {
  const found = useLiveQuery(() => findSuffixedNames());
  if (!found?.length) return null;
  async function tidy() {
    const { count, snapshot } = await trackSave(tidySuffixedNames());
    showMessage(`Tidied ${count} ${count === 1 ? 'name' : 'names'}. Where each is from now shows under its name.`, () => restoreSnapshot(snapshot));
  }
  const example = found[0]!;
  return (
    <div class="card">
      <div class="card__body flow">
        <p>
          {found.length === 1 ? 'One name ends' : `${found.length} names end`} with where it’s from, like “{example.name}”. Mep can show that under the name instead: “{example.tidied}”, from{' '}
          {example.kitchenName}.
        </p>
        <button class="button" type="button" onClick={tidy}>
          Tidy {found.length === 1 ? 'it' : `all ${found.length}`}
        </button>
      </div>
    </div>
  );
}

function Recent() {
  const recent = useLiveQuery(() => listRecent());
  if (!recent?.length) return null;
  const href = { dish: paths.dish, component: paths.component, ingredient: paths.ingredient };
  return (
    <section class="flow" aria-labelledby="recent" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <h2 id="recent" class="section-label">
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

/**
 * The library's filters behind one button (FEEL_PASS 6): where it's from,
 * a section (on a menu), tags and collections. The button shows how many
 * are on.
 */
function useFilters(
  kind: 'dish' | 'component',
  origin: ReturnType<typeof useOrigin>,
  section?: { kitchenId: string; value: string | null; onChange: (id: string | null) => void },
) {
  const tags = useLiveQuery(() => listTags());
  const collections = useLiveQuery(() => listCollections());
  const [tagId, setTagId] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const collection = collections?.find((c) => c.id === collectionId);

  const matches = (item: { id: string; tagIds: string[] }) =>
    (!tagId || item.tagIds.includes(tagId)) && (!collection || inCollection(collection, kind, item.id));
  const count = [tagId, collectionId, origin?.value, section?.value].filter(Boolean).length;
  const hasChoices = Boolean((tags && tags.length) || (collections && collections.length) || origin?.controls || section);

  const button = hasChoices ? (
    <button class="button library-filter" type="button" data-variant="ghost" onClick={() => setOpen(true)} aria-pressed={count > 0}>
      Filter{count ? ` · ${count}` : ''}
    </button>
  ) : null;
  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} title="Filter">
      {open && (
        <>
          {origin?.controls && (
            <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
              <p class="label">Where it’s from</p>
              {origin.controls}
            </div>
          )}
          {section && (
            <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
              <p class="label">Section</p>
              <SectionFilter kitchenId={section.kitchenId} value={section.value} onChange={section.onChange} />
            </div>
          )}
          {tags && tags.length > 0 && <ChipChoice label="Tag" choices={tags.map((t) => ({ value: t.id, label: t.name }))} value={tagId} onChange={setTagId} allowNone reel />}
          {collections && collections.length > 0 && (
            <ChipChoice label="Collection" choices={collections.map((c) => ({ value: c.id, label: c.name }))} value={collectionId} onChange={setCollectionId} allowNone reel />
          )}
          <button class="button" type="button" data-variant="primary" onClick={() => setOpen(false)}>
            Done
          </button>
        </>
      )}
    </Sheet>
  );
  return { matches, origin, button, sheet };
}

/**
 * "Where it's from" (DECISIONS 54): chips for each kitchen with something in
 * the book, then Mine; All shows everything, with where each is from under
 * its name. Starts on the kitchen you're in; the choice is kept for the
 * session.
 */
function useOrigin() {
  const place = useLiveQuery(() => getPlace());
  const choices = useLiveQuery(async () => (place ? originChoices(place.kitchenId) : undefined), [place?.kitchenId]);
  const origins = useLiveQuery(() => componentOrigins());
  const [chosen, setChosen] = useState<string | null>(() => sessionStorage.getItem(ORIGIN_KEY));
  if (!choices || !origins || !place) return undefined;

  const stored = chosen === 'all' ? null : chosen;
  // Only one kitchen in the book: nothing to filter by.
  const fallback = choices.length > 1 && choices.some((c) => c.value === place.kitchenId) ? place.kitchenId : null;
  const value: Origin | null = chosen === null ? fallback : stored && choices.some((c) => c.value === stored) ? stored : null;
  const names = new Map(choices.map((c) => [c.value, c.label]));
  const showWhere = value === null && choices.length > 1;
  const choose = (next: Origin | null) => {
    setChosen(next ?? 'all');
    sessionStorage.setItem(ORIGIN_KEY, next ?? 'all');
  };
  const dishOrigin = (dish: Dish): Origin => dish.kitchenId ?? MINE;

  return {
    value,
    choose,
    matchesDish: (dish: Dish) => value === null || dishOrigin(dish) === value,
    matchesComponent: (id: string) => value === null || Boolean(origins.get(id)?.has(value)),
    /** Where it's from, for its row, when showing everything (always, with `always`). */
    dishWhere: (dish: Dish, always = false) => (showWhere || always ? names.get(dishOrigin(dish)) : undefined),
    componentWhere: (id: string, always = false) =>
      showWhere || always
        ? [...(origins.get(id) ?? [])]
            .map((o) => names.get(o))
            .filter(Boolean)
            .join(', ')
        : undefined,
    controls:
      choices.length < 2 ? null : (
        <div class="reel" role="region" aria-label="Where it’s from" tabIndex={0}>
          {choices.map((c) => (
            <button key={c.value} class="chip" type="button" aria-pressed={value === c.value} onClick={() => choose(c.value)}>
              {c.label}
            </button>
          ))}
          <button class="chip" type="button" aria-pressed={value === null} onClick={() => choose(null)}>
            All
          </button>
        </div>
      ),
  };
}

function inCollection(collection: Collection, kind: 'dish' | 'component', id: string) {
  return collection.members.some((m) => m.kind === kind && m.id === id);
}

/**
 * Dishes by menu and course (R7, UX → Library; FEEL_PASS 6). The menu is a
 * heading ("À la carte · on now ▾") that opens a picker: the menus on now
 * and coming up, or all dishes. Opens on the menu last looked at, else the
 * à la carte, else the first menu on now.
 */
function DishesLens() {
  const dishes = useLiveQuery(() => listDishSummaries());
  const place = useLiveQuery(() => getPlace());
  const menus = useLiveQuery(async () => (place ? (await listMenus(place.kitchenId)).filter((m) => m.status !== 'past') : []), [place?.kitchenId]);
  // Other kitchens' menus too, including ones you've left: you may be writing up a menu from your last job.
  const otherMenus = useLiveQuery(async () => {
    if (!place) return [];
    const out = [];
    for (const kitchen of (await listKitchens()).filter((k) => !k.builtIn && k.id !== place.kitchenId)) {
      for (const menu of (await listMenus(kitchen.id)).filter((m) => m.status !== 'past')) out.push({ menu, kitchen });
    }
    return out;
  }, [place?.kitchenId]);
  const types = useLiveQuery(async () => (place ? getListItems({ kind: 'values', list: 'menu-types', kitchenId: place.kitchenId }) : []), [place?.kitchenId]);
  const lastMenu = useLiveQuery(() => getSetting<string>(MENU_KEY));
  const [chosen, setChosen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const serviceNames = useServiceNames(place?.kitchenId);
  // Opens on a menu served today (DECISIONS 57): the one last looked at if it is, else the à la carte, else the first.
  const fallbackMenu = () => {
    const today = isoDayOfWeek(new Date());
    const current = (menus ?? []).filter((m) => m.status === 'on-now');
    const servedToday = current.filter((m) => servedAt(m, today));
    const isCarte = (m: Menu) => /carte/i.test(types?.find((t) => t.id === m.typeId)?.name ?? m.name);
    const last = menus?.find((m) => m.id === lastMenu);
    const lastOk = (last && (last.status !== 'on-now' || servedAt(last, today))) || otherMenus?.some((o) => o.menu.id === lastMenu);
    return (lastMenu && lastOk ? lastMenu : null) ?? servedToday.find(isCarte)?.id ?? servedToday[0]?.id ?? current.find(isCarte)?.id ?? current[0]?.id ?? menus?.[0]?.id ?? 'all';
  };
  const origin = useOrigin();
  // The menu shown always belongs to the kitchen the filter is on: filtering
  // to Ellenborough Park shows Ellenborough's menu (or its dishes if it has
  // none on), never a Dumbleton menu.
  const allMenus = [...(menus ?? []), ...(otherMenus ?? []).map((o) => o.menu)];
  const requested = chosen ?? fallbackMenu();
  const wanted = origin?.value ?? null;
  const requestedKitchen = allMenus.find((m) => m.id === requested)?.kitchenId;
  let menuId = requested;
  if (wanted && requested !== 'all' && requestedKitchen !== wanted) {
    const ofKitchen = allMenus.filter((m) => m.kitchenId === wanted);
    menuId = (ofKitchen.find((m) => m.status === 'on-now') ?? ofKitchen[0])?.id ?? 'all';
  }
  const view = useLiveQuery(async () => (menuId !== 'all' ? getMenuView(menuId, []) : undefined), [menuId]);
  const filters = useFilters('dish', origin, view ? { kitchenId: view.menu.kitchenId, value: sectionId, onChange: setSectionId } : undefined);
  if (!dishes || !menus || !otherMenus) return null;

  function choose(id: string) {
    setChosen(id);
    setSectionId(null);
    setPicking(false);
    void setSetting(MENU_KEY, id);
    // Picking another kitchen's menu moves the filter with it.
    const kitchenId = allMenus.find((m) => m.id === id)?.kitchenId;
    if (origin?.value && kitchenId && kitchenId !== origin.value) origin.choose(kitchenId);
  }

  const other = otherMenus.find((o) => o.menu.id === menuId);
  const current = menus.find((m) => m.id === menuId) ?? other?.menu;
  const heading = (
    <div class="library-menu-head">
      <button class="library-menu" type="button" onClick={() => setPicking(true)} aria-haspopup="dialog">
        {current ? `${current.name} · ${other ? other.kitchen.name : current.status === 'on-now' ? servedLabel(current, serviceNames).toLowerCase() : 'coming up'}` : 'All dishes'} <Icon name="chevron-down" size="s" />
      </button>
      {filters.button}
    </div>
  );
  const picker = (
    <Sheet open={picking} onClose={() => setPicking(false)} title="Which menu?">
      {picking && (
        <ul class="row-list" role="list">
          <li>
            <a class="list-row" href={paths.menus}>
              <span class="list-row__main">
                <span class="list-row__title">All menus</span>
                <span class="list-row__meta">Current, coming up and past; add, copy or launch one</span>
              </span>
              <Icon name="chevron-right" />
            </a>
          </li>
          {menus.map((m) => (
            <li key={m.id}>
              <button class="list-row" type="button" aria-pressed={m.id === menuId} onClick={() => choose(m.id)}>
                <span class="list-row__main">
                  <span class="list-row__title">{m.name}</span>
                  <span class="list-row__meta">{[servedLabel(m, serviceNames), m.status === 'on-now' ? null : 'coming up'].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
          {otherMenus.map(({ menu, kitchen }) => (
            <li key={menu.id}>
              <button class="list-row" type="button" aria-pressed={menu.id === menuId} onClick={() => choose(menu.id)}>
                <span class="list-row__main">
                  <span class="list-row__title">{menu.name}</span>
                  <span class="list-row__meta">
                    {kitchen.name}
                    {kitchen.archived ? ' (left)' : ''}
                    {menu.status === 'on-now' ? '' : ' · coming up'}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button class="list-row" type="button" aria-pressed={menuId === 'all'} onClick={() => choose('all')}>
              <span class="list-row__main">
                <span class="list-row__title">All dishes</span>
              </span>
            </button>
          </li>
        </ul>
      )}
    </Sheet>
  );

  if (menuId !== 'all') {
    return (
      <>
        {heading}
        {picker}
        {filters.sheet}
        {view && <MenuCourses view={view} sectionId={sectionId} />}
        {/* The menu's own page: prices, the allergen matrix, and Edit to add dishes or change the menu. */}
        {view && (
          <ul class="row-list" role="list">
            <li>
              <a class="list-row" href={paths.menu(view.menu.id)}>
                <span class="list-row__main">
                  <span class="list-row__title">Open {view.menu.name}</span>
                  <span class="list-row__meta">Allergen matrix; Edit to add dishes, prices and courses</span>
                </span>
                <Icon name="chevron-right" />
              </a>
            </li>
          </ul>
        )}
      </>
    );
  }
  if (dishes.length === 0) {
    return (
      <>
        {heading}
        {picker}
        <Empty text="No dishes yet. A dish is anything served, made of components. Tap + New." />
      </>
    );
  }
  const shown = dishes.filter(({ dish }) => filters.matches(dish) && (!origin || origin.matchesDish(dish)));
  return (
    <>
      {heading}
      {picker}
      {filters.sheet}
      {shown.length === 0 && <Empty text="Nothing matches. Change the filter." />}
      <RowList
        rows={shown.map(({ dish, componentCount }) => ({
          href: paths.dish(dish.id),
          title: dish.name,
          meta: [origin?.dishWhere(dish), dish.description || (componentCount === 1 ? '1 component' : `${componentCount} components`)].filter(Boolean).join(' · '),
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
  const origin = useOrigin();
  const filters = useFilters('component', origin);
  if (!summaries || !types || !origin) return null;
  if (summaries.length === 0) return <Empty text="No components yet. A component is a recipe for one part: a stock, a sauce, a garnish. Tap + New." />;

  const shown = summaries.filter(({ component }) => filters.matches(component) && origin.matchesComponent(component.id));
  const knownType = (typeId: string | null) => typeId !== null && types.some((t) => t.id === typeId);
  const groups = [
    ...types.map((t) => ({ key: t.id, name: t.name, items: shown.filter((s) => s.component.typeId === t.id) })),
    { key: 'none', name: 'No type yet', items: shown.filter((s) => !knownType(s.component.typeId)) },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      {filters.button && <div class="library-menu-head">{filters.button}</div>}
      {filters.sheet}
      {groups.length === 0 && <Empty text="Nothing matches. Change the filter." />}
      {groups.map((group) => (
        // One group: open. Several: closed, so the types read as a list (wireframe Library → Components).
        <details key={group.key} class="library-group" open={groups.length === 1}>
          <summary class="library-group__summary">
            {group.name} <span class="list-row__meta">{group.items.length}</span>
          </summary>
          <RowList
            rows={group.items.map(({ component, dishCount, status }) => ({
              href: paths.component(component.id),
              title: component.name,
              marker: status === 'draft' ? 'Draft' : undefined,
              // "in 1 dish" on every row says nothing: only the unusual is worth a line.
              meta: [origin.componentWhere(component.id), dishCount === 0 ? 'not on a dish' : dishCount > 1 ? `in ${dishCount} dishes` : '']
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
          <h2 class="section-label">{letter}</h2>
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
      <Hint name="techniques-legend">Filled: your own notes. Outlined: waiting for your notes.</Hint>
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
  const origin = useOrigin();
  if (!results || !origin) return null;
  // Where each is from, so two dishes called "Steak" can be told apart.
  const groups = [
    { label: 'Dishes', rows: results.dishes.map((d) => ({ href: paths.dish(d.id), title: d.name, meta: origin.dishWhere(d, true) })) },
    {
      label: 'Components',
      rows: results.components.map((c) => ({
        href: paths.component(c.id),
        title: c.name,
        meta: [origin.componentWhere(c.id, true), c.aliases.join(', ')].filter(Boolean).join(' · '),
      })),
    },
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
          <h2 class="section-label">{group.label}</h2>
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
      if (kind === 'dish') onCreated(`${paths.dish(await createDish(name, place!.kitchenId))}?edit=1`);
      if (kind === 'ingredient') onCreated(paths.ingredient(await createIngredient(name)));
      if (kind === 'technique') onCreated(`${paths.technique(await createTechnique(name))}?edit=1`);
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

function RowList({ rows }: { rows: { href: string; title: string; meta?: string; marker?: string }[] }) {
  return (
    <ul class="row-list" role="list">
      {rows.map((row) => (
        <li key={row.href + row.title}>
          <a class="list-row" href={row.href}>
            <span class="list-row__main">
              <span class="list-row__title note-text">
                {row.title}
                {row.marker && <span class="row-marker"> {row.marker}</span>}
              </span>
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

import { useLocation } from 'preact-iso';
import { useState } from 'preact/hooks';
import { formatPrice, parsePrice } from '../../core/money/money';
import { toCalendarDate } from '../../core/time/calendar';
import { createDish, listDishSummaries } from '../../data/library';
import { getPlace, getKitchen, listSections } from '../../data/kitchens';
import { getListItems, ListError } from '../../data/lists';
import {
  addDishToMenu,
  copyMenu,
  createMenu,
  deleteMenu,
  getMenuView,
  launchMenu,
  listMenus,
  moveMenuDish,
  removeDishFromMenu,
  restoreMenus,
  setComponentSection,
  updateMenu,
  updateMenuDish,
  type MenuDishView,
  type MenuView,
} from '../../data/menus';
import { restoreSnapshot } from '../../data/snapshot';
import type { Id, KitchenId, Menu, MenuStatus } from '../../data/types';
import { ChipChoice } from '../components/Controls';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { showMessage } from '../components/UndoBar';
import { formatCalendarDate } from '../format';
import { useEditMode } from '../hooks/useEditMode';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { Hint } from '../components/Hint';

const STATUS_LABELS: Record<MenuStatus, string> = { 'on-now': 'On now', 'coming-up': 'Coming up', past: 'Past' };

/** "Winter · coming up": a menu's name with its status when it isn't on now. */
export function menuLabel(menu: Menu) {
  return menu.status === 'on-now' ? menu.name : `${menu.name} (${STATUS_LABELS[menu.status].toLowerCase()})`;
}

// ─── All menus ────────────────────────────────────────────────────────────

/** The current kitchen's menus: on now, coming up, past (MS4). /menus */
export function MenusList() {
  const { route, query } = useLocation();
  const place = useLiveQuery(() => getPlace());
  // Another kitchen's menus (from its settings), or where the chef is today.
  const kitchenId = query.kitchen ?? place?.kitchenId;
  const kitchen = useLiveQuery(async () => (kitchenId ? getKitchen(kitchenId) : undefined), [kitchenId]);
  const menus = useLiveQuery(async () => (kitchenId ? listMenus(kitchenId) : []), [kitchenId]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function add(event: Event) {
    event.preventDefault();
    if (!kitchenId) return;
    try {
      const id = await trackSave(createMenu(kitchenId, name));
      // A new menu opens ready to add dishes to.
      route(`${paths.menu(id)}?edit=1`);
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add it.');
    }
  }

  return (
    <section class="flow">
      <ScreenHeader title="Menus" back={query.kitchen ? { href: paths.kitchen(query.kitchen), label: kitchen?.name ?? 'Kitchen' } : { href: paths.library, label: 'Library' }} />
      <p class="field__hint">{kitchen ? `${kitchen.name}’s menus.` : ''} Old menus move to past and stay in your book.</p>
      {(['on-now', 'coming-up', 'past'] as const).map((status) => {
        const group = (menus ?? []).filter((m) => m.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} class="flow" aria-label={STATUS_LABELS[status]}>
            <h2 class="section-label">{STATUS_LABELS[status]}</h2>
            <ul class="row-list" role="list">
              {group.map((menu) => (
                <li key={menu.id}>
                  <a class="list-row" href={paths.menu(menu.id)}>
                    <span class="list-row__main">
                      <span class="list-row__title">{menu.name}</span>
                      {(menu.starts || menu.ends) && (
                        <span class="list-row__meta">{[menu.starts && `from ${formatCalendarDate(menu.starts)}`, menu.ends && `to ${formatCalendarDate(menu.ends)}`].filter(Boolean).join(' ')}</span>
                      )}
                    </span>
                    <Icon name="chevron-right" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {menus?.length === 0 && (
        <div class="empty-state">
          <p>No menus yet for this kitchen.</p>
        </div>
      )}
      <form class="input-group" onSubmit={add}>
        <input class="input" aria-label="New menu" placeholder="New menu: À la carte, Sunday lunch…" autocomplete="off" value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <button class="button" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p class="field__error">{error}</p>}
    </section>
  );
}

// ─── One menu ─────────────────────────────────────────────────────────────

/**
 * A menu by course (MS1): /menu/:id
 *
 * Read by default (FEEL_PASS 2): dishes by course, filterable by section;
 * tap a dish for its page. Edit (top right) to add dishes, set each one's
 * course, price and who makes what (tap it), the menu's details, and the
 * changeover tools (MS4): copy, launch, delete.
 */
export function MenuScreen({ id = '' }: { id?: string }) {
  const view = useLiveQuery(() => getMenuView(id, []), [id]);
  const kitchen = useLiveQuery(async () => (view ? getKitchen(view.menu.kitchenId) : undefined), [view?.menu.kitchenId]);
  const [sectionId, setSectionId] = useState<Id | null>(null);
  const [sheet, setSheet] = useState<'add' | 'launch' | null>(null);
  const [openPlace, setOpenPlace] = useState<Id | null>(null);
  const { route } = useLocation();
  const { editing, start, done } = useEditMode();
  if (!view) return <ScreenHeader title="" back={{ href: paths.menus, label: 'Menus' }} />;
  const { menu } = view;
  const open = view.courses.flatMap((c) => c.dishes).find((d) => d.place.id === openPlace);
  const dishCount = view.courses.reduce((n, c) => n + c.dishes.length, 0);

  async function copy() {
    const copyId = await trackSave(copyMenu(menu.id, `${menu.name} (new)`));
    route(paths.menu(copyId));
    showMessage('Copied as a coming-up menu. Change what’s new; launch it when it starts.');
  }

  async function remove() {
    const snapshot = await deleteMenu(menu.id);
    route(paths.menusFor(menu.kitchenId));
    showMessage(`Deleted ${menu.name}. Its dishes are kept.`, () => restoreSnapshot(snapshot));
  }

  const back = { href: paths.menusFor(menu.kitchenId), label: 'Menus' };
  const meta = [
    STATUS_LABELS[menu.status],
    view.typeName,
    kitchen?.name,
    `${dishCount} ${dishCount === 1 ? 'dish' : 'dishes'}`,
    menu.starts && `from ${formatCalendarDate(menu.starts)}`,
    menu.ends && `to ${formatCalendarDate(menu.ends)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  if (editing) {
    return (
      <section class="flow">
        <ScreenHeader title={menu.name} back={back} action={{ label: 'Done', onClick: done }} />
        <button class="button" type="button" data-variant="primary" onClick={() => setSheet('add')}>
          + Add a dish
        </button>
        <Hint name="menu-edit">Tap a dish for its course, price and who makes each part.</Hint>
        <MenuCourses view={view} sectionId={null} onOpen={(placeId) => setOpenPlace(placeId)} />

        <section class="flow" aria-labelledby="menu-details">
          <h2 id="menu-details" class="section-label">
            Menu details
          </h2>
          <MenuSettings menu={menu} />
        </section>

        <section class="flow" aria-labelledby="menu-changeover">
          <h2 id="menu-changeover" class="section-label">
            Changeover
          </h2>
          <div class="cluster">
            <button class="button" type="button" onClick={copy}>
              Copy for a new season
            </button>
            {menu.status === 'coming-up' && (
              <button class="button" type="button" onClick={() => setSheet('launch')}>
                Launch this menu
              </button>
            )}
          </div>
          <button class="button" type="button" data-variant="danger" onClick={remove}>
            Delete menu
          </button>
        </section>

        <Sheet open={sheet === 'add'} onClose={() => setSheet(null)} title={`Add to ${menu.name}`} position="top">
          {sheet === 'add' && <AddDishToMenu menu={menu} onDone={() => setSheet(null)} />}
        </Sheet>
        <Sheet open={sheet === 'launch'} onClose={() => setSheet(null)} title={`Launch ${menu.name}`}>
          {sheet === 'launch' && <LaunchMenu menu={menu} onDone={() => setSheet(null)} />}
        </Sheet>
        <Sheet open={!!open} onClose={() => setOpenPlace(null)} title={open?.dish.name ?? ''}>
          {open && <MenuDishEditor key={open.place.id} view={open} kitchenId={menu.kitchenId} onDone={() => setOpenPlace(null)} />}
        </Sheet>
      </section>
    );
  }

  return (
    <section class="flow">
      <ScreenHeader title={menu.name} back={back} action={{ label: 'Edit', onClick: start }} meta={meta} />
      {view.readiness.total > 0 && (
        <p class="readiness">
          {view.readiness.ready} of {view.readiness.total} components ready
        </p>
      )}
      <SectionFilter kitchenId={menu.kitchenId} value={sectionId} onChange={setSectionId} />
      <MenuCourses view={view} sectionId={sectionId} />
      {dishCount > 0 && (
        <a class="button" href={paths.matrix(menu.id)}>
          Allergen matrix
        </a>
      )}
    </section>
  );
}

/**
 * "All · Fish · Veg…": show only the dishes a section makes part of (MS1).
 * Any section, not "mine": the chef isn't asked where they are (DECISIONS 48).
 */
export function SectionFilter({ kitchenId, value, onChange }: { kitchenId: KitchenId; value: Id | null; onChange: (id: Id | null) => void }) {
  const sections = useLiveQuery(async () => (await listSections(kitchenId)).filter((s) => !s.hidden), [kitchenId]);
  if (!sections || sections.length === 0) return null;
  return (
    <div class="reel" role="region" aria-label="Show dishes for a section" tabIndex={0}>
      <button class="chip" type="button" aria-pressed={value === null} onClick={() => onChange(null)}>
        All sections
      </button>
      {sections.map((s) => (
        <button key={s.id} class="chip" type="button" aria-pressed={value === s.id} onClick={() => onChange(s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  );
}

/** Dishes by course: price, sections, readiness (MS1). Used on the menu screen and in the library. */
export function MenuCourses({ view, sectionId, onOpen }: { view: MenuView; sectionId: Id | null; onOpen?: (placeId: Id) => void }) {
  const touches = (d: MenuDishView) => sectionId === null || d.components.some((c) => c.sectionId === sectionId);
  const courses = view.courses.map((c) => ({ ...c, dishes: c.dishes.filter(touches) })).filter((c) => c.dishes.length > 0);
  if (courses.length === 0) {
    return (
      <div class="empty-state">
        <p>{sectionId ? 'Nothing on this menu is made by that section yet.' : 'No dishes on this menu yet.'}</p>
      </div>
    );
  }
  return (
    <>
      {courses.map((course) => (
        <section key={course.courseId ?? 'none'} class="flow" aria-label={course.name}>
          <h2 class="section-label">{course.name}</h2>
          <ul class="row-list" role="list">
            {course.dishes.map((d) => {
              const ready = d.components.filter((c) => c.ready).length;
              const meta = [
                d.place.price !== null ? formatPrice(d.place.price) : null,
                d.sectionNames.join(', ') || null,
                d.components.length ? `${ready}/${d.components.length} ready` : 'no components',
              ]
                .filter(Boolean)
                .join(' · ');
              const content = (
                <>
                  <span class="list-row__main">
                    <span class="list-row__title">{d.dish.name}</span>
                    <span class="list-row__meta">{meta}</span>
                  </span>
                  <Icon name="chevron-right" />
                </>
              );
              return (
                <li key={d.place.id}>
                  {onOpen ? (
                    <button class="list-row" type="button" onClick={() => onOpen(d.place.id)}>
                      {content}
                    </button>
                  ) : (
                    <a class="list-row" href={paths.dish(d.dish.id)}>
                      {content}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function MenuSettings({ menu }: { menu: Menu }) {
  const types = useLiveQuery(() => getListItems({ kind: 'values', list: 'menu-types', kitchenId: menu.kitchenId }), [menu.kitchenId]);
  const [name, setName] = useState(menu.name);
  return (
    <>
      <div class="field">
        <label class="label" for="menu-name">
          Name
        </label>
        <input class="input" id="menu-name" value={name} autocomplete="off" onInput={(e) => setName(e.currentTarget.value)} onBlur={() => name.trim() && name !== menu.name && trackSave(updateMenu(menu.id, { name }))} />
      </div>
      <ChipChoice
        label="Type"
        choices={(types ?? []).filter((t) => !t.hidden).map((t) => ({ value: t.id, label: t.name }))}
        value={menu.typeId}
        allowNone
        onChange={(typeId) => trackSave(updateMenu(menu.id, { typeId }))}
      />
      <ChipChoice
        label="Status"
        choices={(['coming-up', 'on-now', 'past'] as const).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        value={menu.status}
        onChange={(status) => status && trackSave(updateMenu(menu.id, { status }))}
      />
      <div class="cluster">
        <div class="field">
          <label class="label" for="menu-starts">
            Starts
          </label>
          <input class="input" id="menu-starts" type="date" value={menu.starts ?? ''} onInput={(e) => trackSave(updateMenu(menu.id, { starts: e.currentTarget.value || null }))} />
        </div>
        <div class="field">
          <label class="label" for="menu-ends">
            Ends
          </label>
          <input class="input" id="menu-ends" type="date" value={menu.ends ?? ''} onInput={(e) => trackSave(updateMenu(menu.id, { ends: e.currentTarget.value || null }))} />
        </div>
      </div>
    </>
  );
}

/** Find a dish to add (or make a new one), and choose its course. */
function AddDishToMenu({ menu, onDone }: { menu: Menu; onDone: () => void }) {
  const dishes = useLiveQuery(() => listDishSummaries());
  const courses = useLiveQuery(() => getListItems({ kind: 'values', list: 'courses', kitchenId: menu.kitchenId }), [menu.kitchenId]);
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState<Id | null>(null);
  const matches = (dishes ?? []).filter(({ dish }) => !query.trim() || dish.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30);

  async function add(dishId: Id, name: string) {
    await trackSave(addDishToMenu(menu.id, dishId, courseId));
    showMessage(`Added ${name} to ${menu.name}.`);
    setQuery('');
  }

  return (
    <>
      <ChipChoice label="Course" choices={(courses ?? []).filter((c) => !c.hidden).map((c) => ({ value: c.id, label: c.name }))} value={courseId} allowNone onChange={setCourseId} />
      <input class="input" type="search" aria-label="Find a dish" placeholder="Find a dish, or type a new one" autocomplete="off" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      {query.trim() && !matches.some(({ dish }) => dish.name.toLowerCase() === query.trim().toLowerCase()) && (
        <button class="button" type="button" data-variant="primary" onClick={async () => add(await createDish(query, menu.kitchenId), query.trim())}>
          New dish “{query.trim()}”
        </button>
      )}
      <ul class="row-list" role="list">
        {matches.map(({ dish }) => (
          <li key={dish.id}>
            <button class="list-row" type="button" onClick={() => add(dish.id, dish.name)}>
              <span class="list-row__main">
                <span class="list-row__title">{dish.name}</span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
      <button class="button" type="button" onClick={onDone}>
        Done
      </button>
    </>
  );
}

/** A dish's place on this menu: course, price, target GP, and who makes each component. */
function MenuDishEditor({ view, kitchenId, onDone }: { view: MenuDishView; kitchenId: KitchenId; onDone: () => void }) {
  const courses = useLiveQuery(() => getListItems({ kind: 'values', list: 'courses', kitchenId }), [kitchenId]);
  const sections = useLiveQuery(() => getListItems({ kind: 'sections', kitchenId }), [kitchenId]);
  const [price, setPrice] = useState(view.place.price !== null ? (view.place.price / 100).toFixed(2).replace(/\.00$/, '') : '');
  const [gp, setGp] = useState(view.place.targetGpPercent !== null ? String(view.place.targetGpPercent) : '');
  const { place } = view;

  async function remove() {
    const snapshot = await removeDishFromMenu(place.id);
    onDone();
    showMessage(`Took ${view.dish.name} off the menu.`, () => restoreSnapshot(snapshot));
  }

  return (
    <>
      <ChipChoice
        label="Course"
        choices={(courses ?? []).filter((c) => !c.hidden).map((c) => ({ value: c.id, label: c.name }))}
        value={place.courseId}
        allowNone
        onChange={(courseId) => trackSave(updateMenuDish(place.id, { courseId }))}
      />
      <div class="cluster">
        <div class="field">
          <label class="label" for="dish-price">
            Price (£)
          </label>
          <input class="input" id="dish-price" inputMode="decimal" autocomplete="off" value={price} onInput={(e) => setPrice(e.currentTarget.value)} onBlur={() => trackSave(updateMenuDish(place.id, { price: parsePrice(price) }))} />
        </div>
        <div class="field">
          <label class="label" for="dish-gp">
            Target GP %
          </label>
          <input
            class="input"
            id="dish-gp"
            inputMode="decimal"
            autocomplete="off"
            value={gp}
            onInput={(e) => setGp(e.currentTarget.value)}
            onBlur={() => {
              const n = Number(gp);
              void trackSave(updateMenuDish(place.id, { targetGpPercent: gp.trim() && Number.isFinite(n) ? n : null }));
            }}
          />
        </div>
      </div>

      <h3>Who makes what</h3>
      {view.components.length === 0 && <p class="field__hint">This dish has no components yet. Add them on the dish.</p>}
      {view.components.map(({ component, sectionId, ready }) => (
        <ChipChoice
          key={component.id}
          label={`${component.name}${ready ? '' : ' (draft)'}`}
          choices={(sections ?? []).filter((s) => !s.hidden).map((s) => ({ value: s.id, label: s.name }))}
          value={sectionId}
          allowNone
          onChange={(next) => trackSave(setComponentSection(place.id, component.id, next))}
        />
      ))}

      <div class="cluster">
        <button class="button" type="button" onClick={() => trackSave(moveMenuDish(place.id, -1))}>
          Move up
        </button>
        <button class="button" type="button" onClick={() => trackSave(moveMenuDish(place.id, 1))}>
          Move down
        </button>
      </div>
      <a class="button" href={paths.dish(view.dish.id)} onClick={onDone}>
        Open the dish
      </a>
      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Take off this menu
      </button>
    </>
  );
}

/** Launch day (MS4): this menu goes on now; the ones it replaces move to past. */
function LaunchMenu({ menu, onDone }: { menu: Menu; onDone: () => void }) {
  const others = useLiveQuery(async () => (await listMenus(menu.kitchenId)).filter((m) => m.status === 'on-now' && m.id !== menu.id), [menu.id]);
  const [replaces, setReplaces] = useState<Id[] | null>(null);
  const chosen = replaces ?? (others?.filter((m) => m.typeId === menu.typeId || m.id === menu.copiedFromId).map((m) => m.id) ?? []);

  async function launch() {
    const before = await trackSave(launchMenu(menu.id, chosen, toCalendarDate(new Date())));
    onDone();
    showMessage(`${menu.name} is on now.${chosen.length ? ' The old menu is in past.' : ''}`, () => restoreMenus(before));
  }

  return (
    <>
      {others && others.length > 0 ? (
        <>
          <p class="field__hint">Which menus does it replace? They move to past; nothing is deleted.</p>
          <div class="cluster" role="group" aria-label="Replaces">
            {others.map((m) => (
              <button
                key={m.id}
                class="chip"
                type="button"
                aria-pressed={chosen.includes(m.id)}
                onClick={() => setReplaces(chosen.includes(m.id) ? chosen.filter((x) => x !== m.id) : [...chosen, m.id])}
              >
                {m.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p class="field__hint">No other menu is on now.</p>
      )}
      <button class="button" type="button" data-variant="primary" onClick={launch}>
        Launch today
      </button>
    </>
  );
}

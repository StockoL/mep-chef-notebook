import { useLocation } from 'preact-iso';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { setDishKitchen } from '../../data/dishOrigin';
import { formatAmount } from '../../core/scaling/rounding';
import { UNIT_CHOICES, type Unit } from '../../core/units/units';
import { getPlace } from '../../data/kitchens';
import {
  addComponentToDish,
  deleteComponent,
  deleteDish,
  deleteIngredient,
  getComponentDetails,
  getDishDetails,
  getIngredientDetails,
  moveDishComponent,
  removeComponentFromDish,
  setBaseYield,
  setDishPhoto,
  updateComponent,
  updateDish,
  updateIngredient,
  setVariationOrigin,
  type DishDetails,
  type VariationOrigin,
} from '../../data/library';
import { createKitchen, getKitchen, listKitchens, setKitchenArchived } from '../../data/kitchens';
import { getListItems, ListError } from '../../data/lists';
import { listComponentNotes } from '../../data/notes';
import { menusForComponent, menusForDish, tagSuggestions } from '../../data/menus';
import { addDishToSheet } from '../../data/dishes';
import { componentAllergens, dishAllergens } from '../../data/allergens';
import { AllergenPicker, AllergenSummaryView, MadeButton, ProductsSection } from '../components/FoodSafety';
import { getDishPortions } from '../../data/scaling';
import { getScaleChoice, setScaleChoice } from '../../data/scaling';
import { recordView } from '../../data/search';
import { restoreSnapshot } from '../../data/snapshot';
import type { Variation } from '../../data/types';
import { ChipChoice, Segmented } from '../components/Controls';
import {
  AliasesField,
  CollectionToggles,
  ComponentPicker,
  LinesEditor,
  NameField,
  TagEditor,
  TextAreaField,
} from '../components/LibraryEditors';
import { MediaView } from '../components/MediaView';
import { MethodEditor } from '../components/MethodEditor';
import { techniquesForIngredient } from '../../data/techniques';
import { menuLabel } from './Menus';
import { AttemptLog, IdeaFields, VariationActions, VariationChips } from '../components/Variations';
import { IngredientWeights, PerPortionButton, PortionsPanel, ScalePanel } from '../components/Scaling';
import { NoteEditor } from '../components/NoteEditor';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { showMessage } from '../components/UndoBar';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { shrinkPhoto } from '../media';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

const BACK = { href: paths.library, label: 'Library' };
const COMPONENT_TYPES = { kind: 'values', list: 'component-types', kitchenId: null } as const;

// ─── Component ────────────────────────────────────────────────────────────

/** A component's page (UX → Component): /library/component/:id */
export function ComponentPage({ id = '' }: { id?: string }) {
  const place = useLiveQuery(() => getPlace());
  const kitchenId = place?.kitchenId;
  const { route, query } = useLocation();
  // Another way of making it, when the chef taps its chip (V4); otherwise the one in use here.
  const shownId = query.v ?? null;
  const details = useLiveQuery(async () => (kitchenId ? getComponentDetails(id, kitchenId, undefined, shownId) : undefined), [id, kitchenId, shownId]);
  const types = useLiveQuery(() => getListItems(COMPONENT_TYPES));
  const notes = useLiveQuery(() => listComponentNotes(id), [id]);
  const choice = useLiveQuery(() => getScaleChoice(id), [id]);
  const menus = useLiveQuery(() => menusForComponent(id), [id]);
  const tagHints = useLiveQuery(() => tagSuggestions({ kind: 'component', id }), [id]);

  useEffect(() => void recordView({ kind: 'component', id }), [id]);
  // Opened "to make" an amount (from a dish, a sheet item or a recipe that uses it): scale to it.
  useEffect(() => {
    const amount = Number(query.make);
    if (query.make && Number.isFinite(amount) && amount > 0 && query.unit) {
      void setScaleChoice(id, { by: 'yield', amount, unit: query.unit });
    }
  }, [id, query.make, query.unit]);

  if (!details) return <ScreenHeader title="" back={BACK} />;
  const { component, variation, lines, steps, dishes, usedInComponents } = details;

  async function remove() {
    try {
      const snapshot = await deleteComponent(id);
      route(paths.library);
      showMessage(`Deleted “${component.name}”.`, () => restoreSnapshot(snapshot));
    } catch (e) {
      showMessage(e instanceof ListError ? e.message : 'Couldn’t delete it.');
    }
  }

  return (
    <section class="flow" key={id}>
      <ScreenHeader title={component.name} back={BACK} />
      {variation && kitchenId && <VariationChips componentId={id} kitchenId={kitchenId} shown={variation} />}
      {variation && <VariationLine variation={variation} />}
      {variation?.source === 'idea' && <IdeaFields key={variation.id} variation={variation} />}
      {kitchenId && choice !== undefined && <ScalePanel componentId={id} kitchenId={kitchenId} choice={choice} variationId={variation?.id ?? null} />}

      {variation && <YieldField key={variation.id} variation={variation} />}

      {/* While scaled, the scaled list stands in for the editor: the recipe is only edited as written. */}
      {variation && !choice && <LinesEditor key={`lines-${variation.id}`} variationId={variation.id} componentId={id} lines={lines} />}
      {variation && <MethodEditor key={`steps-${variation.id}`} variation={variation} steps={steps} componentName={component.name} />}
      <MadeButton componentId={id} label="Made a batch: label it" />

      {/* Everything else about the recipe, folded away (DECISIONS 54): the page opens on what you cook from. */}
      <MoreAbout storageKey="more.component" title="More about this recipe">
        <NameField value={component.name} onSave={(name) => updateComponent(id, { name })} />
        <ChipChoice
          label="Type"
          choices={(types ?? []).filter((t) => !t.hidden || t.id === component.typeId).map((t) => ({ value: t.id, label: t.name }))}
          value={component.typeId}
          onChange={(typeId) => trackSave(updateComponent(id, { typeId }))}
          allowNone
        />

        <TagEditor tagIds={component.tagIds} onChange={(tagIds) => updateComponent(id, { tagIds })} suggested={tagHints ?? []} />
        <AliasesField aliases={component.aliases} onSave={(aliases) => updateComponent(id, { aliases })} />
        <CollectionToggles member={{ kind: 'component', id }} />

        <UsedIn
          groups={[
            { label: 'In dishes', items: dishes.map((d) => ({ href: paths.dish(d.id), name: d.name })) },
            { label: 'Used in components', items: usedInComponents.map((c) => ({ href: paths.component(c.id), name: c.name })) },
            { label: 'On menus', items: (menus ?? []).map((m) => ({ href: paths.menu(m.id), name: m.status === 'on-now' ? m.name : `${m.name} (${m.status === 'past' ? 'past' : 'coming up'})` })) },
          ]}
          empty="Not on any dish yet."
        />

        <section class="flow" aria-labelledby="component-notes">
          <h2 id="component-notes">Notes and attempts</h2>
          {variation && kitchenId && <AttemptLog componentId={id} variationId={variation.id} kitchenId={kitchenId} />}
          {notes?.map((note) => (
            <div key={note.id} class="card">
              <div class="card__body">
                <p class="field__hint">{new Date(note.createdAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <NoteEditor note={note} />
              </div>
            </div>
          ))}
        </section>

        {variation && kitchenId && <ComponentAllergens componentId={id} kitchenId={kitchenId} variationId={variation.id} />}

        {variation && kitchenId && <VariationActions componentId={id} kitchenId={kitchenId} shown={variation} />}

        <button class="button" type="button" data-variant="danger" onClick={remove}>
          Delete component
        </button>
      </MoreAbout>
    </section>
  );
}

/**
 * "House recipe · Dumbleton Hall · Draft": whose version this is (V4). Tap
 * it to say where the recipe is from: a kitchen's house recipe (including
 * kitchens you've left), your own, a book or another chef, or an idea.
 */
function VariationLine({ variation }: { variation: Variation }) {
  const kitchen = useLiveQuery(async () => (variation.kitchenId ? getKitchen(variation.kitchenId) : undefined), [variation.kitchenId]);
  const [open, setOpen] = useState(false);
  const source = { house: 'House recipe', mine: 'Your own', book: 'From', idea: 'An idea' }[variation.source];
  const where = variation.source === 'house' ? kitchen?.name : variation.source === 'book' ? (variation.sourceDetail ?? 'a book or chef') : variation.sourceDetail;
  return (
    <>
      <button class="variation-line" type="button" onClick={() => setOpen(true)} aria-label="Where this recipe is from">
        {[variation.source === 'book' ? `${source} ${where}` : source, variation.source === 'book' ? null : where, variation.status === 'draft' ? 'Draft' : 'Ready']
          .filter(Boolean)
          .join(' · ')}
        <Icon name="chevron-right" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Where’s this recipe from?">
        {open && <OriginEditor variation={variation} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

function OriginEditor({ variation, onDone }: { variation: Variation; onDone: () => void }) {
  const kitchens = useLiveQuery(() => listKitchens());
  const [source, setSource] = useState<Variation['source']>(variation.source);
  const [detail, setDetail] = useState(variation.sourceDetail ?? '');
  const [newKitchen, setNewKitchen] = useState('');
  const [error, setError] = useState('');
  const real = (kitchens ?? []).filter((k) => !k.builtIn);

  const save = (origin: VariationOrigin) => trackSave(setVariationOrigin(variation.id, origin));

  async function addKitchen(event: Event) {
    event.preventDefault();
    try {
      const id = await createKitchen(newKitchen);
      await setKitchenArchived(id, true);
      await save({ source: 'house', kitchenId: id });
      showMessage(`${newKitchen.trim()} added to your kitchens as one you’ve left. Its recipes stay in your book.`);
      setNewKitchen('');
      onDone();
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add it.');
    }
  }

  return (
    <>
      <ChipChoice
        label="It’s…"
        choices={[
          { value: 'house', label: 'A kitchen’s house recipe' },
          { value: 'mine', label: 'My own' },
          { value: 'book', label: 'From a book or another chef' },
          { value: 'idea', label: 'An idea' },
        ]}
        value={source}
        onChange={(next) => {
          if (!next) return;
          setSource(next);
          if (next === 'mine' || next === 'idea') void save({ source: next, sourceDetail: detail.trim() || null });
        }}
      />

      {source === 'house' && (
        <>
          <ChipChoice
            label="Which kitchen?"
            choices={real.map((k) => ({ value: k.id, label: k.archived ? `${k.name} (left)` : k.name }))}
            value={variation.source === 'house' ? variation.kitchenId : null}
            onChange={async (kitchenId) => {
              if (!kitchenId) return;
              await save({ source: 'house', kitchenId });
              onDone();
            }}
          />
          <form class="input-group" onSubmit={addKitchen}>
            <input
              class="input"
              aria-label="Another kitchen"
              placeholder="A kitchen you’ve worked in"
              autocomplete="off"
              value={newKitchen}
              onInput={(e) => setNewKitchen(e.currentTarget.value)}
            />
            <button class="button" type="submit" disabled={!newKitchen.trim()}>
              Add
            </button>
          </form>
          {error && <p class="field__error">{error}</p>}
        </>
      )}

      {source !== 'house' && (
        <div class="field">
          <label class="label" for="origin-detail">
            {source === 'book' ? 'Which book or chef?' : 'Note (optional)'}
          </label>
          <input
            class="input"
            id="origin-detail"
            autocomplete="off"
            placeholder={source === 'book' ? 'Leiths, Chef Tom…' : ''}
            value={detail}
            onInput={(e) => setDetail(e.currentTarget.value)}
            onBlur={() => save(source === 'book' ? { source: 'book', sourceDetail: detail.trim() || null } : { source, sourceDetail: detail.trim() || null })}
          />
        </div>
      )}
      <p class="field__hint">A house recipe uses that kitchen’s equipment and shows first when you’re there. Keeping several versions of one recipe comes next, with variations.</p>
      <button class="button" type="button" data-variant="primary" onClick={onDone}>
        Done
      </button>
    </>
  );
}

/** Base yield: how much the recipe as written makes. Scaling (Phase 5) works from it. */
function YieldField({ variation }: { variation: Variation }) {
  const [amount, setAmount] = useState(variation.baseYield ? String(variation.baseYield.amount) : '');
  const [unit, setUnit] = useState<Unit>((variation.baseYield?.unit as Unit | undefined) ?? 'l');
  const save = (nextAmount: string, nextUnit: Unit) => {
    const number = Number(nextAmount.replace(',', '.'));
    const value = nextAmount.trim() && Number.isFinite(number) ? { amount: number, unit: nextUnit } : null;
    void trackSave(setBaseYield(variation.id, value));
  };
  return (
    <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <div class="field">
        <label class="label" for="yield">
          Makes
        </label>
        <input
          class="input"
          id="yield"
          inputMode="decimal"
          value={amount}
          placeholder="e.g. 3"
          onInput={(e) => setAmount(e.currentTarget.value)}
          onBlur={() => save(amount, unit)}
        />
      </div>
      <ChipChoice
        label="Yield unit"
        choices={UNIT_CHOICES.map((u) => ({ value: u, label: u === 'portion' ? 'portions' : u }))}
        value={unit}
        onChange={(u) => {
          if (!u) return;
          setUnit(u);
          if (amount.trim()) save(amount, u);
        }}
      />
    </div>
  );
}

// ─── Dish ─────────────────────────────────────────────────────────────────

/** A dish's page (UX → Dish): /library/dish/:id */
export function DishPage({ id = '' }: { id?: string }) {
  const details = useLiveQuery(() => getDishDetails(id), [id]);
  const place = useLiveQuery(() => getPlace());
  const dishMenus = useLiveQuery(() => menusForDish(id), [id]);
  const dishTagHints = useLiveQuery(() => tagSuggestions({ kind: 'dish', id }), [id]);
  const [picking, setPicking] = useState(false);
  const [editingList, setEditingList] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const { route } = useLocation();

  useEffect(() => void recordView({ kind: 'dish', id }), [id]);

  if (!details) return <ScreenHeader title="" back={BACK} />;
  const { dish, components } = details;

  async function onPhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await trackSave(setDishPhoto(id, await shrinkPhoto(file)));
  }

  async function remove() {
    const snapshot = await deleteDish(id);
    route(paths.library);
    showMessage(`Deleted “${dish.name}”.`, () => restoreSnapshot(snapshot));
  }

  return (
    <section class="flow" key={id}>
      <ScreenHeader title={dish.name} back={BACK} />
      <DishOriginLine dishId={id} kitchenId={dish.kitchenId} />

      <DishComponents
        dishId={id}
        dishName={dish.name}
        components={components}
        onAdd={() => setPicking(true)}
        editing={editingList}
        onToggleEditing={() => setEditingList(!editingList)}
      />

      {components.length > 0 && place && <DishAtWork dishId={id} kitchenId={place.kitchenId} />}
      {components.length > 0 && place && <PortionsPanel dishId={id} kitchenId={place.kitchenId} />}

      <section class="flow" aria-labelledby="plating">
        <h2 id="plating">Plating</h2>
        {dish.platingPhotoId && <MediaView id={dish.platingPhotoId} />}
        <div class="cluster">
          <button class="button" type="button" onClick={() => photoInput.current?.click()}>
            <Icon name="camera" /> {dish.platingPhotoId ? 'Replace photo' : 'Add a plating photo'}
          </button>
          {dish.platingPhotoId && (
            <button class="button" type="button" data-variant="ghost" onClick={() => trackSave(setDishPhoto(id, null))}>
              Remove photo
            </button>
          )}
        </div>
        <input ref={photoInput} class="visually-hidden" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={onPhoto} />
        <TextAreaField
          id="plating-spec"
          label="Plating spec"
          value={dish.platingSpec}
          placeholder="Gel swoosh left, three quenelles, cress on top"
          onSave={(platingSpec) => updateDish(id, { platingSpec })}
        />
      </section>

      <MoreAbout storageKey="more.dish" title="More about this dish">
        <NameField value={dish.name} onSave={(name) => updateDish(id, { name })} />
        <TextAreaField
          id="dish-description"
          label="Description"
          value={dish.description}
          placeholder="As it reads on the menu"
          onSave={(description) => updateDish(id, { description })}
        />

        <UsedIn
          groups={[{ label: 'On menus', items: (dishMenus ?? []).map(({ menu }) => ({ href: paths.menu(menu.id), name: menuLabel(menu) })) }]}
          empty="Not on a menu. Add it from a menu: Library → Dishes → Menus."
        />

        <TagEditor tagIds={dish.tagIds} onChange={(tagIds) => updateDish(id, { tagIds })} suggested={dishTagHints ?? []} />
        <CollectionToggles member={{ kind: 'dish', id }} />

        <button class="button" type="button" data-variant="danger" onClick={remove}>
          Delete dish
        </button>
      </MoreAbout>

      {place && (
        <ComponentPicker
          open={picking}
          onClose={() => setPicking(false)}
          kitchenId={place.kitchenId}
          exclude={components.map((c) => c.component.id)}
          onPick={async (componentId, name) => {
            await trackSave(addComponentToDish(id, componentId));
            showMessage(`Added ${name} to ${dish.name}.`);
          }}
        />
      )}
    </section>
  );
}

/** A dish's components: tap one to open it; "Amounts, order, remove" to edit the list. */
function DishComponents({
  dishId,
  dishName,
  components,
  onAdd,
  editing,
  onToggleEditing,
}: {
  dishId: string;
  dishName: string;
  components: DishDetails['components'];
  onAdd: () => void;
  editing: boolean;
  onToggleEditing: () => void;
}) {
  return (
      <section class="flow" aria-labelledby="dish-components">
        <h2 id="dish-components">Components</h2>
        {components.length === 0 && <p class="field__hint">Add each part of the dish: the purée, the sauce, the garnish.</p>}
        <ul class="row-list" role="list">
          {components.map(({ link, component }, index) => (
            <li key={link.id}>
              {editing ? (
                <div class="list-row" data-static>
                  <span class="list-row__main">
                    <span class="list-row__title">{component.name}</span>
                    <PerPortionButton link={link} name={component.name} />
                  </span>
                  <button class="button" type="button" data-variant="ghost" aria-label={`Move ${component.name} up`} disabled={index === 0} onClick={() => trackSave(moveDishComponent(dishId, link.id, -1))}>
                    ↑
                  </button>
                  <button class="button" type="button" data-variant="ghost" aria-label={`Move ${component.name} down`} disabled={index === components.length - 1} onClick={() => trackSave(moveDishComponent(dishId, link.id, 1))}>
                    ↓
                  </button>
                  <button
                    class="button"
                    type="button"
                    data-variant="ghost"
                    aria-label={`Take ${component.name} off this dish`}
                    onClick={async () => {
                      const removed = await removeComponentFromDish(link.id);
                      if (removed) showMessage(`Took ${component.name} off ${dishName}.`, () => restoreSnapshot({ dishComponents: [removed] }));
                    }}
                  >
                    <Icon name="bin" />
                  </button>
                </div>
              ) : (
                <a class="list-row" href={paths.component(component.id)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{component.name}</span>
                    {link.quantityPerPortion && (
                      <span class="list-row__meta">{formatAmount(link.quantityPerPortion.amount, link.quantityPerPortion.unit)} a portion</span>
                    )}
                  </span>
                  <Icon name="chevron-right" />
                </a>
              )}
            </li>
          ))}
        </ul>
        <div class="cluster">
          <button class="button" type="button" data-variant="primary" onClick={onAdd}>
            Add a component
          </button>
          {components.length > 0 && (
            <button class="button" type="button" onClick={onToggleEditing} aria-pressed={editing}>
              {editing ? 'Done' : 'Amounts, order, remove'}
            </button>
          )}
        </div>
      </section>
  );
}

// ─── Ingredient ───────────────────────────────────────────────────────────

/** An ingredient's page (I1, UX → Ingredient): /library/ingredient/:id */
export function IngredientPage({ id = '' }: { id?: string }) {
  const details = useLiveQuery(() => getIngredientDetails(id), [id]);
  const applied = useLiveQuery(() => techniquesForIngredient(id), [id]);
  const { route } = useLocation();

  useEffect(() => void recordView({ kind: 'ingredient', id }), [id]);

  if (!details) return <ScreenHeader title="" back={BACK} />;
  const { ingredient, components, dishes } = details;

  async function remove() {
    try {
      const deleted = await deleteIngredient(id);
      route(paths.library);
      if (deleted) showMessage(`Deleted “${deleted.name}”.`, () => restoreSnapshot({ ingredients: [deleted] }));
    } catch (e) {
      showMessage(e instanceof ListError ? e.message : 'Couldn’t delete it.');
    }
  }

  return (
    <section class="flow" key={id}>
      <ScreenHeader title={ingredient.name} back={BACK} />

      <UsedIn
        groups={[
          { label: 'In dishes', items: dishes.map((d) => ({ href: paths.dish(d.id), name: d.name })) },
          { label: 'In components', items: components.map((c) => ({ href: paths.component(c.id), name: c.name })) },
        ]}
        empty="Nothing in your book uses it yet."
      />

      {applied && applied.length > 0 && (
        <section class="flow" aria-labelledby="applied-title">
          <h2 id="applied-title">Techniques applied</h2>
          <ul class="row-list" role="list">
            {applied.map(({ technique, components }) => (
              <li key={technique.id}>
                <a class="list-row" href={paths.technique(technique.id)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{technique.name}</span>
                    <span class="list-row__meta">{components.map((c) => c.name).join(', ')}</span>
                  </span>
                  <Icon name="chevron-right" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NameField value={ingredient.name} onSave={(name) => updateIngredient(id, { name })} />
      <AliasesField aliases={ingredient.aliases} onSave={(aliases) => updateIngredient(id, { aliases })} />
      <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
        <p class="label">Kind</p>
        <Segmented
          label="Kind"
          choices={[
            { value: 'basic', label: 'Basic' },
            { value: 'bought-in', label: 'Bought-in' },
          ]}
          value={ingredient.kind}
          onChange={(kind) => trackSave(updateIngredient(id, { kind }))}
        />
      </div>

      {ingredient.kind === 'basic' ? (
        <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
          <AllergenPicker label="Allergens" value={ingredient.allergens} onChange={(allergens) => trackSave(updateIngredient(id, { allergens }))} />
          <p class="field__hint">What this ingredient contains. Every recipe using it gathers these.</p>
        </div>
      ) : (
        <ProductsSection key={`products-${ingredient.id}`} ingredientId={ingredient.id} ingredientName={ingredient.name} />
      )}

      <IngredientWeights key={ingredient.id} ingredient={ingredient} />

      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Delete ingredient
      </button>
    </section>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────

/**
 * "More about this recipe": the setup and reference parts of a page, folded
 * away so it opens on what you cook from. Remembers whether it was left
 * open (per kind of page, for this session).
 */
function MoreAbout({ storageKey, title, children }: { storageKey: string; title: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(() => sessionStorage.getItem(storageKey) === 'open');
  return (
    <details
      class="more-about"
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        setOpen(next);
        sessionStorage.setItem(storageKey, next ? 'open' : 'closed');
      }}
    >
      <summary class="more-about__summary">{title}</summary>
      {open && <div class="flow more-about__body">{children}</div>}
    </details>
  );
}

/**
 * Where a dish is from (DECISIONS 54): "Dumbleton Hall · on À la carte".
 * Tap it to change the kitchen, or make it your own.
 */
function DishOriginLine({ dishId, kitchenId }: { dishId: string; kitchenId: string | null }) {
  const kitchens = useLiveQuery(() => listKitchens());
  const dishMenus = useLiveQuery(() => menusForDish(dishId), [dishId]);
  const [open, setOpen] = useState(false);
  const real = (kitchens ?? []).filter((k) => !k.builtIn);
  const kitchen = real.find((k) => k.id === kitchenId);
  const onMenus = (dishMenus ?? []).filter(({ menu }) => menu.kitchenId === kitchenId).map(({ menu }) => menuLabel(menu));
  const label = [kitchen ? kitchen.name : 'Your own', onMenus.length ? `on ${onMenus.join(', ')}` : null].filter(Boolean).join(' · ');
  return (
    <>
      <button class="variation-line" type="button" onClick={() => setOpen(true)} aria-label="Where this dish is from">
        {label}
        <Icon name="chevron-right" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Where’s this dish from?">
        {open && (
          <>
            <ChipChoice
              label="Kitchen"
              choices={[...real.map((k) => ({ value: k.id, label: k.archived ? `${k.name} (left)` : k.name })), { value: 'mine', label: 'My own' }]}
              value={kitchenId ?? 'mine'}
              onChange={async (next) => {
                if (!next) return;
                await trackSave(setDishKitchen(dishId, next === 'mine' ? null : next));
                setOpen(false);
              }}
            />
            <p class="field__hint">Shown under the name and used by the library’s filter, so the name can stay as the menu writes it.</p>
            <button class="button" type="button" data-variant="primary" onClick={() => setOpen(false)}>
              Done
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}

/** "Used in" lists, built automatically (UX → Editing rule 8: shown, never asked for). */
function UsedIn({ groups, empty }: { groups: { label: string; items: { href: string; name: string }[] }[]; empty: string }) {
  const any = groups.some((g) => g.items.length > 0);
  return (
    <section class="flow" aria-label="Used in">
      {!any && <p class="field__hint">{empty}</p>}
      {groups
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <div key={group.label} class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
            <h2 class="used-in__label">{group.label}</h2>
            <ul class="row-list" role="list">
              {group.items.map((item) => (
                <li key={item.href}>
                  <a class="list-row" href={item.href}>
                    <span class="list-row__main">
                      <span class="list-row__title">{item.name}</span>
                    </span>
                    <Icon name="chevron-right" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}

/**
 * A dish at work (MS2): its allergens gathered from every component, and
 * one tap to put its components on today's sheet (with amounts, when a
 * number of covers is set above).
 */
function DishAtWork({ dishId, kitchenId }: { dishId: string; kitchenId: string }) {
  const allergens = useLiveQuery(() => dishAllergens(dishId, kitchenId), [dishId, kitchenId]);
  const portions = useLiveQuery(() => getDishPortions(dishId), [dishId]);

  async function addToSheet() {
    const { added } = await trackSave(addDishToSheet(dishId, portions ?? null));
    showMessage(`Put ${added} ${added === 1 ? 'component' : 'components'} on today’s sheet${portions ? ` for ${portions}` : ''}.`, { view: { label: 'View', href: paths.today } });
  }

  return (
    <section class="flow">
      <button class="button" type="button" data-variant="primary" onClick={addToSheet}>
        Add to today’s sheet{portions ? ` for ${portions}` : ''}
      </button>
      {allergens && <AllergenSummaryView allergens={allergens} kitchenId={kitchenId} />}
    </section>
  );
}

/** A component's allergens, through every component it uses (FS1), for the variation shown. */
function ComponentAllergens({ componentId, kitchenId, variationId }: { componentId: string; kitchenId: string; variationId: string }) {
  const allergens = useLiveQuery(() => componentAllergens(componentId, kitchenId, variationId), [componentId, kitchenId, variationId]);
  return allergens ? <AllergenSummaryView allergens={allergens} kitchenId={kitchenId} /> : null;
}

import { useLocation } from 'preact-iso';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ALLERGENS, type AllergenId } from '../../core/allergens/allergens';
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
} from '../../data/library';
import { getKitchen } from '../../data/kitchens';
import { getListItems, ListError } from '../../data/lists';
import { listComponentNotes } from '../../data/notes';
import { recordView } from '../../data/search';
import { restoreSnapshot } from '../../data/snapshot';
import type { Variation } from '../../data/types';
import { ChipChoice, ChipToggles, Segmented } from '../components/Controls';
import {
  AliasesField,
  CollectionToggles,
  ComponentPicker,
  LinesEditor,
  NameField,
  StepsEditor,
  TagEditor,
  TextAreaField,
} from '../components/LibraryEditors';
import { MediaView } from '../components/MediaView';
import { NoteEditor } from '../components/NoteEditor';
import { ScreenHeader } from '../components/ScreenHeader';
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
  const details = useLiveQuery(async () => (kitchenId ? getComponentDetails(id, kitchenId) : undefined), [id, kitchenId]);
  const types = useLiveQuery(() => getListItems(COMPONENT_TYPES));
  const notes = useLiveQuery(() => listComponentNotes(id), [id]);
  const { route } = useLocation();

  useEffect(() => void recordView({ kind: 'component', id }), [id]);

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
      {variation && <VariationLine variation={variation} />}

      <NameField value={component.name} onSave={(name) => updateComponent(id, { name })} />
      <ChipChoice
        label="Type"
        choices={(types ?? []).filter((t) => !t.hidden || t.id === component.typeId).map((t) => ({ value: t.id, label: t.name }))}
        value={component.typeId}
        onChange={(typeId) => trackSave(updateComponent(id, { typeId }))}
        allowNone
      />
      {variation && <YieldField key={variation.id} variation={variation} />}

      {variation && <LinesEditor key={`lines-${variation.id}`} variationId={variation.id} componentId={id} lines={lines} />}
      {variation && <StepsEditor key={`steps-${variation.id}`} variationId={variation.id} steps={steps} />}

      <TagEditor tagIds={component.tagIds} onChange={(tagIds) => updateComponent(id, { tagIds })} />
      <AliasesField aliases={component.aliases} onSave={(aliases) => updateComponent(id, { aliases })} />
      <CollectionToggles member={{ kind: 'component', id }} />

      <UsedIn
        groups={[
          { label: 'In dishes', items: dishes.map((d) => ({ href: paths.dish(d.id), name: d.name })) },
          { label: 'Used in components', items: usedInComponents.map((c) => ({ href: paths.component(c.id), name: c.name })) },
        ]}
        empty="Not on any dish yet."
      />

      {notes && notes.length > 0 && (
        <section class="flow" aria-labelledby="component-notes">
          <h2 id="component-notes">Notes</h2>
          {notes.map((note) => (
            <div key={note.id} class="card">
              <div class="card__body">
                <NoteEditor note={note} />
              </div>
            </div>
          ))}
        </section>
      )}

      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Delete component
      </button>
    </section>
  );
}

/** "House variation · Dumbleton Hall · Draft": whose version this is (V4). */
function VariationLine({ variation }: { variation: Variation }) {
  const kitchen = useLiveQuery(async () => (variation.kitchenId ? getKitchen(variation.kitchenId) : undefined), [variation.kitchenId]);
  const source = { house: 'House variation', mine: 'Your own variation', book: 'From a book or chef', idea: 'An idea' }[variation.source];
  return (
    <p class="variation-line">
      {[source, kitchen?.name, variation.status === 'draft' ? 'Draft' : 'Ready'].filter(Boolean).join(' · ')}
    </p>
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
      <NameField value={dish.name} onSave={(name) => updateDish(id, { name })} />
      <TextAreaField
        id="dish-description"
        label="Description"
        value={dish.description}
        placeholder="As it reads on the menu"
        onSave={(description) => updateDish(id, { description })}
      />

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

      <section class="flow" aria-labelledby="dish-components">
        <h2 id="dish-components">Components</h2>
        {components.length === 0 && <p class="field__hint">Add each part of the dish: the purée, the sauce, the garnish.</p>}
        <ul class="row-list" role="list">
          {components.map(({ link, component }, index) => (
            <li key={link.id}>
              {editingList ? (
                <div class="list-row" data-static>
                  <span class="list-row__main">
                    <span class="list-row__title">{component.name}</span>
                  </span>
                  <button class="button" type="button" data-variant="ghost" aria-label={`Move ${component.name} up`} disabled={index === 0} onClick={() => trackSave(moveDishComponent(id, link.id, -1))}>
                    ↑
                  </button>
                  <button class="button" type="button" data-variant="ghost" aria-label={`Move ${component.name} down`} disabled={index === components.length - 1} onClick={() => trackSave(moveDishComponent(id, link.id, 1))}>
                    ↓
                  </button>
                  <button
                    class="button"
                    type="button"
                    data-variant="ghost"
                    aria-label={`Take ${component.name} off this dish`}
                    onClick={async () => {
                      const removed = await removeComponentFromDish(link.id);
                      if (removed) showMessage(`Took ${component.name} off ${dish.name}.`, () => restoreSnapshot({ dishComponents: [removed] }));
                    }}
                  >
                    <Icon name="bin" />
                  </button>
                </div>
              ) : (
                <a class="list-row" href={paths.component(component.id)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{component.name}</span>
                  </span>
                  <Icon name="chevron-right" />
                </a>
              )}
            </li>
          ))}
        </ul>
        <div class="cluster">
          <button class="button" type="button" data-variant="primary" onClick={() => setPicking(true)}>
            Add a component
          </button>
          {components.length > 0 && (
            <button class="button" type="button" onClick={() => setEditingList(!editingList)} aria-pressed={editingList}>
              {editingList ? 'Done reordering' : 'Reorder or remove'}
            </button>
          )}
        </div>
      </section>

      <TagEditor tagIds={dish.tagIds} onChange={(tagIds) => updateDish(id, { tagIds })} />
      <CollectionToggles member={{ kind: 'dish', id }} />

      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Delete dish
      </button>

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

// ─── Ingredient ───────────────────────────────────────────────────────────

/** An ingredient's page (I1, UX → Ingredient): /library/ingredient/:id */
export function IngredientPage({ id = '' }: { id?: string }) {
  const details = useLiveQuery(() => getIngredientDetails(id), [id]);
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
          <p class="label">Allergens</p>
          <ChipToggles<AllergenId>
            label="Allergens"
            choices={ALLERGENS.map((a) => ({ value: a.id, label: a.label }))}
            values={ingredient.allergens}
            onChange={(allergens) => trackSave(updateIngredient(id, { allergens }))}
          />
          <p class="field__hint">What this ingredient contains. Dishes and components will gather these with food safety.</p>
        </div>
      ) : (
        <p class="field__hint">A bought-in ingredient’s allergens come from the exact product your kitchen uses, added with food safety.</p>
      )}

      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Delete ingredient
      </button>
    </section>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────

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

import { useLocation } from 'preact-iso';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ALLERGENS, type AllergenId } from '../../core/allergens/allergens';
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
  type VariationOrigin,
} from '../../data/library';
import { createKitchen, getKitchen, listKitchens, setKitchenArchived } from '../../data/kitchens';
import { getListItems, ListError } from '../../data/lists';
import { listComponentNotes } from '../../data/notes';
import { getScaleChoice, setScaleChoice } from '../../data/scaling';
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
  TagEditor,
  TextAreaField,
} from '../components/LibraryEditors';
import { MediaView } from '../components/MediaView';
import { MethodEditor } from '../components/MethodEditor';
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
  const details = useLiveQuery(async () => (kitchenId ? getComponentDetails(id, kitchenId) : undefined), [id, kitchenId]);
  const types = useLiveQuery(() => getListItems(COMPONENT_TYPES));
  const notes = useLiveQuery(() => listComponentNotes(id), [id]);
  const choice = useLiveQuery(() => getScaleChoice(id), [id]);
  const { route, query } = useLocation();

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
      {variation && <VariationLine variation={variation} />}
      {kitchenId && choice !== undefined && <ScalePanel componentId={id} kitchenId={kitchenId} choice={choice} />}

      <NameField value={component.name} onSave={(name) => updateComponent(id, { name })} />
      <ChipChoice
        label="Type"
        choices={(types ?? []).filter((t) => !t.hidden || t.id === component.typeId).map((t) => ({ value: t.id, label: t.name }))}
        value={component.typeId}
        onChange={(typeId) => trackSave(updateComponent(id, { typeId }))}
        allowNone
      />
      {variation && <YieldField key={variation.id} variation={variation} />}

      {/* While scaled, the scaled list stands in for the editor: the recipe is only edited as written. */}
      {variation && !choice && <LinesEditor key={`lines-${variation.id}`} variationId={variation.id} componentId={id} lines={lines} />}
      {variation && <MethodEditor key={`steps-${variation.id}`} variation={variation} steps={steps} />}

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
                    <PerPortionButton link={link} name={component.name} />
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
          <button class="button" type="button" data-variant="primary" onClick={() => setPicking(true)}>
            Add a component
          </button>
          {components.length > 0 && (
            <button class="button" type="button" onClick={() => setEditingList(!editingList)} aria-pressed={editingList}>
              {editingList ? 'Done' : 'Amounts, order, remove'}
            </button>
          )}
        </div>
      </section>

      {components.length > 0 && place && <PortionsPanel dishId={id} kitchenId={place.kitchenId} />}

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

      <IngredientWeights key={ingredient.id} ingredient={ingredient} />

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

import { useState } from 'preact/hooks';
import { nameContains } from '../../core/ingredients/names';
import { formatQuantity, UNIT_CHOICES, type Unit } from '../../core/units/units';
import { listComponents } from '../../data/components';
import { getPlace, listSections } from '../../data/kitchens';
import { getCountView } from '../../data/stock';
import { menuComponentsForSection } from '../../data/menus';
import { createIngredient, listIngredients } from '../../data/library';
import { addSectionItem, getChosenSection, listSectionItems, setChosenSection, moveSectionItem, removeSectionItem, updateSectionItem, type SectionItemView } from '../../data/sectionItems';
import { restoreSnapshot } from '../../data/snapshot';
import type { Id } from '../../data/types';
import { ChipChoice } from '../components/Controls';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { showMessage } from '../components/UndoBar';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { Hint } from '../components/Hint';

/**
 * A section's list (SPEC → Sections): the components and ingredients the
 * section looks after, with pars and where they're kept. Any section: chips
 * at the top, opening on the last one used (DECISIONS 48). Fills the sheet
 * in a few taps; counts and orders build on it later.
 */
export function SectionList() {
  const place = useLiveQuery(() => getPlace());
  const kitchenId = place?.kitchenId;
  const sections = useLiveQuery(async () => (kitchenId ? (await listSections(kitchenId)).filter((s) => !s.hidden) : []), [kitchenId]);
  const sectionId = useLiveQuery(async () => (kitchenId ? getChosenSection(kitchenId) : null), [kitchenId]) ?? null;
  const items = useLiveQuery(async () => (sectionId ? listSectionItems(sectionId) : []), [sectionId]);
  // What the menus on now give this section (MS4), less what's already on the list.
  const fromMenus = useLiveQuery(async () => (sectionId ? menuComponentsForSection(sectionId) : []), [sectionId]);
  const menuOnly = (fromMenus ?? []).filter((m) => !(items ?? []).some((i) => i.item.componentId === m.component.id));
  const [editingId, setEditingId] = useState<Id | null>(null);
  const [adding, setAdding] = useState(false);
  const editing = items?.find((i) => i.item.id === editingId);

  if (!place || !sections) return null;
  if (!sectionId || !kitchenId) {
    return (
      <section class="flow">
        <ScreenHeader title="Section list" back={{ href: paths.section, label: 'Section' }} />
        <div class="empty-state">
          <p>This kitchen has no sections yet. Add them in kitchen settings (••• → Kitchens).</p>
        </div>
      </section>
    );
  }

  return (
    <section class="flow">
      <ScreenHeader title="Section list" back={{ href: paths.section, label: 'Section' }} />
      <div class="reel" role="region" aria-label="Section" tabIndex={0}>
        {sections.map((s) => (
          <button key={s.id} class="chip" type="button" aria-pressed={s.id === sectionId} onClick={() => setChosenSection(kitchenId, s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      {items?.length === 0 && menuOnly.length === 0 && (
        <div class="empty-state flow">
          <p>What does this section look after? Add the components and ingredients you prep and top up.</p>
        </div>
      )}
      <ul class="row-list" role="list">
        {items?.map((s) => (
          <li key={s.item.id}>
            <button class="list-row" type="button" onClick={() => setEditingId(s.item.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{s.name}</span>
                <span class="list-row__meta">
                  {[s.item.par ? `par ${formatQuantity(s.item.par.amount, s.item.par.unit)}` : 'no par', s.item.shelfPosition].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
      <button class="button" type="button" data-variant="primary" onClick={() => setAdding(true)}>
        + Add to the list
      </button>

      {menuOnly.length > 0 && (
        <section class="flow" aria-labelledby="from-menus">
          <h2 class="section-label" id="from-menus">From the menus on now</h2>
          <Hint name="section-from-menus">Tap one to give it a par or a shelf.</Hint>
          <ul class="row-list" role="list">
            {menuOnly.map(({ component, menuNames }) => (
              <li key={component.id}>
                <button
                  class="list-row"
                  type="button"
                  onClick={async () => {
                    const itemId = await trackSave(addSectionItem(sectionId, { componentId: component.id }));
                    setEditingId(itemId);
                  }}
                >
                  <span class="list-row__main">
                    <span class="list-row__title">{component.name}</span>
                    <span class="list-row__meta">on {menuNames.join(', ')}</span>
                  </span>
                  <Icon name="chevron-right" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={!!editing} onClose={() => setEditingId(null)} title={editing?.name ?? ''}>
        {editing && <ItemEditor key={editing.item.id} view={editing} sectionId={sectionId} isFirst={items?.[0]?.item.id === editing.item.id} isLast={items?.at(-1)?.item.id === editing.item.id} onDone={() => setEditingId(null)} />}
      </Sheet>
      <AddItemSheet open={adding} onClose={() => setAdding(false)} sectionId={sectionId} />
    </section>
  );
}

function ItemEditor(props: { view: SectionItemView; sectionId: Id; isFirst: boolean; isLast: boolean; onDone: () => void }) {
  const { view, sectionId, isFirst, isLast, onDone } = props;
  const { item } = view;
  const [amount, setAmount] = useState(item.par ? String(item.par.amount) : '');
  const [unit, setUnit] = useState<Unit>((item.par?.unit as Unit | undefined) ?? 'each');
  const [shelf, setShelf] = useState(item.shelfPosition ?? '');

  const savePar = (nextAmount: string, nextUnit: Unit) => {
    const number = Number(nextAmount.replace(',', '.'));
    const par = nextAmount.trim() && Number.isFinite(number) ? { amount: number, unit: nextUnit } : null;
    void trackSave(updateSectionItem(item.id, { par }));
  };

  async function remove() {
    const removed = await removeSectionItem(item.id);
    onDone();
    if (removed) showMessage(`Took ${view.name} off the list.`, () => restoreSnapshot({ sectionItems: [removed] }));
  }

  return (
    <>
      <div class="field">
        <label class="label" for="par">
          Par (what you keep topped up to)
        </label>
        <input class="input" id="par" inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} onBlur={() => savePar(amount, unit)} />
      </div>
      <ParSuggestion
        sectionId={sectionId}
        itemId={item.id}
        onUse={(par) => {
          setAmount(String(par));
          savePar(String(par), unit);
        }}
      />
      <ChipChoice
        label="Unit"
        choices={UNIT_CHOICES.map((u) => ({ value: u, label: u === 'portion' ? 'portions' : u }))}
        value={unit}
        onChange={(u) => {
          if (!u) return;
          setUnit(u);
          if (amount.trim()) savePar(amount, u);
        }}
      />
      <div class="field">
        <label class="label" for="shelf">
          Where it’s kept
        </label>
        <input
          class="input"
          id="shelf"
          value={shelf}
          placeholder="Walk-in, shelf 2"
          onInput={(e) => setShelf(e.currentTarget.value)}
          onBlur={() => trackSave(updateSectionItem(item.id, { shelfPosition: shelf.trim() || null }))}
        />
      </div>
      <div class="cluster">
        <button class="button" type="button" disabled={isFirst} onClick={() => trackSave(moveSectionItem(sectionId, item.id, -1))}>
          Move up
        </button>
        <button class="button" type="button" disabled={isLast} onClick={() => trackSave(moveSectionItem(sectionId, item.id, 1))}>
          Move down
        </button>
      </div>
      {item.componentId && (
        <a class="button" href={paths.component(item.componentId)} onClick={onDone}>
          Open the recipe
        </a>
      )}
      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Take off the list
      </button>
    </>
  );
}

/** Find a component or ingredient to add, or add a new ingredient by name. */
function AddItemSheet({ open, onClose, sectionId }: { open: boolean; onClose: () => void; sectionId: Id }) {
  const components = useLiveQuery(() => listComponents());
  const ingredients = useLiveQuery(() => listIngredients());
  const [query, setQuery] = useState('');
  const matchesQuery = (item: { name: string; aliases: string[] }) => !query.trim() || nameContains(item, query);

  async function add(target: { componentId: Id } | { ingredientId: Id }, name: string) {
    await trackSave(addSectionItem(sectionId, target));
    showMessage(`Added ${name} to the list.`);
    setQuery('');
  }

  const options = [
    ...(components ?? []).filter(matchesQuery).map((c) => ({ key: `c-${c.id}`, name: c.name, meta: 'component', target: { componentId: c.id } })),
    ...(ingredients ?? []).filter(matchesQuery).map((i) => ({ key: `i-${i.id}`, name: i.name, meta: 'ingredient', target: { ingredientId: i.id } })),
  ].slice(0, 30);

  return (
    <Sheet open={open} onClose={onClose} title="Add to the section list" position="top">
      <input
        class="input"
        type="search"
        aria-label="Find a component or ingredient"
        placeholder="Find a component or ingredient"
        value={query}
        autocomplete="off"
        onInput={(e) => setQuery(e.currentTarget.value)}
      />
      {query.trim() && options.length === 0 && (
        <button
          class="button"
          type="button"
          data-variant="primary"
          onClick={async () => add({ ingredientId: await createIngredient(query) }, query.trim())}
        >
          New ingredient “{query.trim()}”
        </button>
      )}
      <ul class="row-list" role="list">
        {options.map((option) => (
          <li key={option.key}>
            <button class="list-row" type="button" onClick={() => add(option.target, option.name)}>
              <span class="list-row__main">
                <span class="list-row__title">{option.name}</span>
                <span class="list-row__meta">{option.meta}</span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** A new par to consider, from counts and waste: only ever a suggestion. */
function ParSuggestion({ sectionId, itemId, onUse }: { sectionId: Id; itemId: Id; onUse: (par: number) => void }) {
  const place = useLiveQuery(() => getPlace());
  const view = useLiveQuery(async () => (place ? getCountView(sectionId, place.kitchenId) : undefined), [sectionId, place?.kitchenId]);
  const suggestion = view?.rows.find((r) => r.view.item.id === itemId)?.suggestion;
  if (!suggestion) return null;
  return (
    <p class="field__hint">
      {suggestion.reason}{' '}
      <button class="button" type="button" data-variant="ghost" onClick={() => onUse(suggestion.par)}>
        Make the par {suggestion.par}
      </button>
    </p>
  );
}

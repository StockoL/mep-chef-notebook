import { useState } from 'preact/hooks';
import { listSections, listServices } from '../../data/kitchens';
import { getChosenSection, listSectionEntries, setChosenSection, type SectionListEntry } from '../../data/sectionItems';
import { addSheetItems, readTypedItem, type SheetItemInput } from '../../data/sheets';
import type { Id, KitchenId } from '../../data/types';
import { formatQuantity } from '../../core/units/units';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { ChipChoice } from './Controls';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

interface AddToSheetProps {
  open: boolean;
  onClose: () => void;
  kitchenId: KitchenId;
  /** Makes the sheet on first use (today's may not exist yet). */
  ensureSheet: () => Promise<Id>;
}

/**
 * Adding to a sheet (SH2, UX → Editing rules 6 and 7): type an item the way
 * you'd write it ("beurre blanc 2l"), or tap items on a section's list to
 * collect them in a tray, then add them all at once. A section item with a
 * par is added as "top up to par". The list opens on the section last used;
 * any other is one tap on its chip (DECISIONS 48).
 * Common path: + Add → tap 3 items → Add 3 (5 taps).
 */
export function AddToSheet({ open, onClose, kitchenId, ensureSheet }: AddToSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Add to the sheet" position="top">
      <AddForm kitchenId={kitchenId} ensureSheet={ensureSheet} onClose={onClose} />
    </Sheet>
  );
}

function AddForm({ kitchenId, ensureSheet, onClose }: Omit<AddToSheetProps, 'open'>) {
  const sections = useLiveQuery(() => listSections(kitchenId), [kitchenId]);
  const chosen = useLiveQuery(() => getChosenSection(kitchenId), [kitchenId]);
  const lists = useLiveQuery(async () => (chosen ? listSectionEntries([chosen]) : []), [chosen]);
  const services = useLiveQuery(() => listServices(kitchenId), [kitchenId]);
  const [typed, setTyped] = useState('');
  // Picked items, kept while hopping between sections' lists.
  const [tray, setTray] = useState<Map<string, SectionListEntry>>(new Map());
  const [serviceId, setServiceId] = useState<Id | null>(null);

  async function addTyped(event: Event) {
    event.preventDefault();
    const input = await readTypedItem(typed, kitchenId);
    if (!input) return;
    await addSheetItems(await ensureSheet(), [{ ...input, source: 'manual', serviceId }]);
    showMessage(`Added ${typed.trim()}.`);
    setTyped('');
  }

  async function addTray() {
    const picked = [...tray.values()];
    const inputs: SheetItemInput[] = picked.map((s) =>
      s.stored
        ? { sectionItemId: s.stored.item.id, topUpTo: s.stored.item.par, serviceId, source: 'section-list' }
        : { componentId: s.componentId, serviceId, source: 'section-list' },
    );
    await addSheetItems(await ensureSheet(), inputs);
    showMessage(`Added ${picked.length} ${picked.length === 1 ? 'item' : 'items'} to the sheet.`);
    setTray(new Map());
    onClose();
  }

  return (
    <>
      <form class="flow" onSubmit={addTyped} style={{ '--flow-space': 'var(--space-2xs)' }}>
        <label class="label" for="sheet-typed">
          Type an item
        </label>
        <div class="input-group">
          <input
            class="input"
            id="sheet-typed"
            value={typed}
            placeholder="beurre blanc 2l"
            autocomplete="off"
            enterkeyhint="done"
            onInput={(e) => setTyped(e.currentTarget.value)}
          />
          <button class="button" type="submit" disabled={!typed.trim()}>
            Add
          </button>
        </div>
      </form>

      {services && services.some((s) => !s.hidden && s.iWorkThis) && (
        <ChipChoice
          label="For service (optional)"
          choices={services.filter((s) => !s.hidden && s.iWorkThis).map((s) => ({ value: s.id, label: s.name }))}
          value={serviceId}
          onChange={setServiceId}
          allowNone
        />
      )}

      <h3 class="used-in__label">From a section’s list</h3>
      {sections && sections.length > 1 && (
        <div class="reel" role="region" aria-label="Section" tabIndex={0}>
          {sections
            .filter((s) => !s.hidden)
            .map((s) => (
              <button key={s.id} class="chip" type="button" aria-pressed={s.id === chosen} onClick={() => setChosenSection(kitchenId, s.id)}>
                {s.name}
              </button>
            ))}
        </div>
      )}
      {lists && lists.length === 0 && <p class="field__hint">Nothing on this section’s list yet. Section tab → Section list to add what it looks after.</p>}
      <ul class="row-list" role="list">
        {lists?.map((s) => {
          const picked = tray.has(s.key);
          const par = s.stored?.item.par;
          return (
            <li key={s.key}>
              <button
                class="list-row"
                type="button"
                aria-pressed={picked}
                onClick={() => {
                  const next = new Map(tray);
                  if (picked) next.delete(s.key);
                  else next.set(s.key, s);
                  setTray(next);
                }}
              >
                <span class="list-row__main">
                  <span class="list-row__title">{s.name}</span>
                  {(par || s.menuNames.length > 0) && (
                    <span class="list-row__meta">
                      {[par ? `top up to ${formatQuantity(par.amount, par.unit)}` : null, s.menuNames.length ? `on ${s.menuNames.join(', ')}` : null].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                {picked && <Icon name="tick" />}
              </button>
            </li>
          );
        })}
      </ul>

      {tray.size > 0 && (
        <button class="button" type="button" data-variant="primary" onClick={addTray}>
          Add {tray.size} to the sheet
        </button>
      )}
    </>
  );
}

import { useState } from 'preact/hooks';
import { listServices } from '../../data/kitchens';
import { listSectionEntries } from '../../data/sectionItems';
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
  sectionIds: Id[];
  /** Makes the sheet on first use (today's may not exist yet). */
  ensureSheet: () => Promise<Id>;
}

/**
 * Adding to a sheet (SH2, UX → Editing rules 6 and 7): type an item the way
 * you'd write it ("beurre blanc 2l"), or tap items on your section list to
 * collect them in a tray, then add them all at once. A section item with a
 * par is added as "top up to par".
 * Common path: + Add → tap 3 items → Add 3 (5 taps).
 */
export function AddToSheet({ open, onClose, kitchenId, sectionIds, ensureSheet }: AddToSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Add to the sheet" position="top">
      <AddForm kitchenId={kitchenId} sectionIds={sectionIds} ensureSheet={ensureSheet} onClose={onClose} />
    </Sheet>
  );
}

function AddForm({ kitchenId, sectionIds, ensureSheet, onClose }: Omit<AddToSheetProps, 'open'>) {
  const lists = useLiveQuery(() => listSectionEntries(sectionIds), [sectionIds.join()]);
  const services = useLiveQuery(() => listServices(kitchenId), [kitchenId]);
  const [typed, setTyped] = useState('');
  const [tray, setTray] = useState<string[]>([]);
  const [serviceId, setServiceId] = useState<Id | null>(null);

  async function addTyped(event: Event) {
    event.preventDefault();
    const input = await readTypedItem(typed, sectionIds);
    if (!input) return;
    await addSheetItems(await ensureSheet(), [{ ...input, source: 'manual', serviceId }]);
    showMessage(`Added ${typed.trim()}.`);
    setTyped('');
  }

  async function addTray() {
    const chosen = (lists ?? []).filter((s) => tray.includes(s.key));
    const inputs: SheetItemInput[] = chosen.map((s) =>
      s.stored
        ? { sectionItemId: s.stored.item.id, topUpTo: s.stored.item.par, serviceId, source: 'section-list' }
        : { componentId: s.componentId, serviceId, source: 'section-list' },
    );
    await addSheetItems(await ensureSheet(), inputs);
    showMessage(`Added ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} to the sheet.`);
    setTray([]);
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

      <h3 class="used-in__label">Your section list</h3>
      {lists && lists.length === 0 && (
        <p class="field__hint">Nothing on your section list yet. Section tab → Section list to add what you look after.</p>
      )}
      <ul class="row-list" role="list">
        {lists?.map((s) => {
          const chosen = tray.includes(s.key);
          const par = s.stored?.item.par;
          return (
            <li key={s.key}>
              <button
                class="list-row"
                type="button"
                aria-pressed={chosen}
                onClick={() => setTray(chosen ? tray.filter((key) => key !== s.key) : [...tray, s.key])}
              >
                <span class="list-row__main">
                  <span class="list-row__title">{s.name}</span>
                  {(par || s.menuNames.length > 0) && (
                    <span class="list-row__meta">
                      {[par ? `top up to ${formatQuantity(par.amount, par.unit)}` : null, s.menuNames.length ? `on ${s.menuNames.join(', ')}` : null].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                {chosen && <Icon name="tick" />}
              </button>
            </li>
          );
        })}
      </ul>

      {tray.length > 0 && (
        <button class="button" type="button" data-variant="primary" onClick={addTray}>
          Add {tray.length} to the sheet
        </button>
      )}
    </>
  );
}

import { useState } from 'preact/hooks';
import { sheetProgress } from '../../core/sheet/sheet';
import { UNIT_CHOICES, type Unit } from '../../core/units/units';
import { listServices } from '../../data/kitchens';
import { deleteSheetItem, setItemDone, updateSheetItem, type SheetItemView, type SheetView as SheetData } from '../../data/sheets';
import { restoreSnapshot } from '../../data/snapshot';
import type { KitchenId } from '../../data/types';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { ChipChoice, Segmented } from './Controls';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

/**
 * A shift sheet's items (SH1): progress at the top, then each item with a
 * big tick. Ticking settles it to the bottom; tapping the rest of the row
 * opens it to change the amount or service, open its recipe, or delete it.
 * Common path during a shift: tick (1 tap).
 */
export function SheetItems({ view, kitchenId }: { view: SheetData; kitchenId: KitchenId }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = view.items.find((v) => v.item.id === openId);
  const { done, total } = sheetProgress(view.items.map((v) => v.item));

  async function toggle(item: SheetItemView) {
    await setItemDone(item.item.id, !item.item.done);
    if (!item.item.done) showMessage(`Done: ${item.name}.`, () => setItemDone(item.item.id, false));
  }

  return (
    <div class="flow">
      {total > 0 && (
        <div class="sheet-progress">
          <span>
            <strong>{done}</strong> of {total} done
          </span>
          <progress class="progress" max={total} value={done} aria-label="Sheet progress" />
        </div>
      )}
      <ul class="row-list" role="list">
        {view.items.map((v) => (
          <li key={v.item.id} class="sheet-row" data-done={v.item.done}>
            <button
              class="sheet-row__tick"
              type="button"
              aria-pressed={v.item.done}
              aria-label={v.item.done ? `Untick ${v.name}` : `Tick ${v.name}`}
              onClick={() => toggle(v)}
            >
              <Icon name="tick" />
            </button>
            <button class="sheet-row__main" type="button" onClick={() => setOpenId(v.item.id)}>
              <span class="sheet-row__name">
                {v.name}
                {v.isDraft && <span class="badge" data-status="warning">Draft</span>}
              </span>
              <span class="sheet-row__meta">
                {[v.amount, v.serviceName, v.item.source === 'carried-over' ? 'carried over' : ''].filter(Boolean).join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''}>
        {open && <ItemEditor key={open.item.id} view={open} kitchenId={kitchenId} onDone={() => setOpenId(null)} />}
      </Sheet>
    </div>
  );
}

type AmountKind = 'make' | 'top-up';

/** One item: how much (to make, or to top up to), for which service, its recipe, delete. */
function ItemEditor({ view, kitchenId, onDone }: { view: SheetItemView; kitchenId: KitchenId; onDone: () => void }) {
  const { item } = view;
  const services = useLiveQuery(() => listServices(kitchenId), [kitchenId]);
  const current = item.topUpTo ?? item.quantity;
  const [kind, setKind] = useState<AmountKind>(item.topUpTo ? 'top-up' : 'make');
  const [amount, setAmount] = useState(current ? String(current.amount) : '');
  const [unit, setUnit] = useState<Unit>((current?.unit as Unit | undefined) ?? 'each');

  const save = (nextKind: AmountKind, nextAmount: string, nextUnit: Unit) => {
    const number = Number(nextAmount.replace(',', '.'));
    const value = nextAmount.trim() && Number.isFinite(number) ? { amount: number, unit: nextUnit } : null;
    void trackSave(
      updateSheetItem(item.id, nextKind === 'top-up' ? { topUpTo: value, quantity: null } : { quantity: value, topUpTo: null }),
    );
  };

  async function remove() {
    const deleted = await deleteSheetItem(item.id);
    onDone();
    if (deleted) showMessage(`Took ${view.name} off the sheet.`, () => restoreSnapshot({ sheetItems: [deleted] }));
  }

  return (
    <>
      {view.isDraft && <p class="field__hint">Its recipe is still a draft, so the plan will leave it to you.</p>}
      <Segmented<AmountKind>
        label="Amount"
        choices={[
          { value: 'make', label: 'Make' },
          { value: 'top-up', label: 'Top up to' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          save(k, amount, unit);
        }}
      />
      <div class="field">
        <label class="label" for="item-amount">
          {kind === 'make' ? 'How much to make' : 'Top up to'}
        </label>
        <input
          class="input"
          id="item-amount"
          inputMode="decimal"
          value={amount}
          onInput={(e) => setAmount(e.currentTarget.value)}
          onBlur={() => save(kind, amount, unit)}
        />
      </div>
      <ChipChoice
        label="Unit"
        choices={UNIT_CHOICES.map((u) => ({ value: u, label: u === 'portion' ? 'portions' : u }))}
        value={unit}
        onChange={(u) => {
          if (!u) return;
          setUnit(u);
          if (amount.trim()) save(kind, amount, u);
        }}
      />
      {services && services.some((s) => !s.hidden) && (
        <ChipChoice
          label="For service"
          choices={services.filter((s) => !s.hidden).map((s) => ({ value: s.id, label: s.name }))}
          value={item.serviceId}
          onChange={(serviceId) => trackSave(updateSheetItem(item.id, { serviceId }))}
          allowNone
        />
      )}
      {view.componentId && (
        <a class="button" href={paths.component(view.componentId)} onClick={onDone}>
          Open the recipe
        </a>
      )}
      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Take off the sheet
      </button>
    </>
  );
}

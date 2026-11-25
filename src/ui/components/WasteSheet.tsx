import { useState } from 'preact/hooks';
import { UNIT_CHOICES, type Unit } from '../../core/units/units';
import { getListItems, ListError } from '../../data/lists';
import type { WasteEntry } from '../../data/types';
import { deleteWaste, logWaste, restoreWaste, updateWaste } from '../../data/waste';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { paths } from '../router';
import { ChipChoice } from './Controls';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

/** The unit picked last time: the likeliest next time (UX → Editing rule 4). */
let lastUnit: Unit = 'portion';

const WASTE_REASONS = { kind: 'values', list: 'waste-reasons', kitchenId: null } as const;

/**
 * Logging waste (A4): what, how much, why. No costs until Phase 11.
 * With `entry`, the same form corrects an existing entry.
 * Common path: tap the bin → type what → tap a reason → Log (3 taps + typing).
 */
export function WasteSheet({ open, onClose, entry }: { open: boolean; onClose: () => void; entry?: WasteEntry }) {
  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Waste entry' : 'Log waste'}>
      <WasteForm key={entry?.id ?? 'new'} entry={entry} onDone={onClose} />
    </Sheet>
  );
}

function WasteForm({ entry, onDone }: { entry?: WasteEntry; onDone: () => void }) {
  const reasons = useLiveQuery(() => getListItems(WASTE_REASONS));
  const [text, setText] = useState(entry?.text ?? '');
  const [amount, setAmount] = useState(entry?.quantity ? String(entry.quantity.amount) : '');
  const [unit, setUnit] = useState<Unit>((entry?.quantity?.unit as Unit | undefined) ?? lastUnit);
  const [reasonId, setReasonId] = useState<string | null>(entry?.reasonId ?? null);
  const [error, setError] = useState('');

  async function submit(event: Event) {
    event.preventDefault();
    const number = Number(amount.replace(',', '.'));
    const input = {
      text,
      quantity: amount && Number.isFinite(number) ? { amount: number, unit } : null,
      reasonId,
    };
    try {
      if (entry) {
        await updateWaste(entry.id, input);
        onDone();
        showMessage('Waste entry updated.');
      } else {
        const id = await logWaste(input);
        lastUnit = unit;
        onDone();
        showMessage('Waste logged.', { undo: async () => void (await deleteWaste(id)), view: { href: paths.waste } });
      }
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t save that.');
    }
  }

  async function remove() {
    if (!entry) return;
    const deleted = await deleteWaste(entry.id);
    onDone();
    if (deleted) showMessage('Waste entry deleted.', () => restoreWaste(deleted));
  }

  // Hidden reasons stay selectable on an entry that already uses one.
  const reasonChoices = (reasons ?? [])
    .filter((r) => !r.hidden || r.id === entry?.reasonId)
    .map((r) => ({ value: r.id, label: r.name }));

  return (
    <form class="flow" onSubmit={submit}>
      <div class="field">
        <label class="label" for="waste-what">
          What
        </label>
        <input class="input" id="waste-what" value={text} autocomplete="off" onInput={(e) => setText(e.currentTarget.value)} />
        {error && <p class="field__error">{error}</p>}
      </div>
      <div class="field">
        <label class="label" for="waste-amount">
          How much
        </label>
        <input class="input" id="waste-amount" inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
      </div>
      <ChipChoice
        label="Unit"
        choices={UNIT_CHOICES.map((u) => ({ value: u, label: u === 'portion' ? 'portions' : u }))}
        value={unit}
        onChange={(u) => u && setUnit(u)}
      />
      <ChipChoice label="Why" choices={reasonChoices} value={reasonId} onChange={setReasonId} allowNone />
      <button class="button" type="submit" data-variant="primary" disabled={!text.trim()}>
        {entry ? 'Save changes' : 'Log waste'}
      </button>
      {entry && (
        <button class="button" type="button" data-variant="danger" onClick={remove}>
          Delete
        </button>
      )}
    </form>
  );
}

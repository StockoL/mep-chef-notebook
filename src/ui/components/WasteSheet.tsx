import { useState } from 'preact/hooks';
import { UNIT_CHOICES, type Unit } from '../../core/units/units';
import { getListItems, ListError } from '../../data/lists';
import { deleteWaste, logWaste } from '../../data/waste';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { ChipChoice } from './Controls';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

/** The unit picked last time: the likeliest next time (UX → Editing rule 4). */
let lastUnit: Unit = 'portion';

const WASTE_REASONS = { kind: 'values', list: 'waste-reasons', kitchenId: null } as const;

/**
 * Logging waste (A4): what, how much, why. No costs until Phase 11.
 * Common path: tap the bin → type what → tap a reason → Log (3 taps + typing).
 */
export function WasteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Log waste">
      <WasteForm onDone={onClose} />
    </Sheet>
  );
}

function WasteForm({ onDone }: { onDone: () => void }) {
  const reasons = useLiveQuery(() => getListItems(WASTE_REASONS));
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<Unit>(lastUnit);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function submit(event: Event) {
    event.preventDefault();
    const number = Number(amount.replace(',', '.'));
    try {
      const id = await logWaste({
        text,
        quantity: amount && Number.isFinite(number) ? { amount: number, unit } : null,
        reasonId,
      });
      lastUnit = unit;
      onDone();
      showMessage('Waste logged.', async () => void (await deleteWaste(id)));
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t log that.');
    }
  }

  return (
    <form class="flow" onSubmit={submit}>
      <div class="field">
        <label class="label" for="waste-what">
          What
        </label>
        <input
          class="input"
          id="waste-what"
          value={text}
          autocomplete="off"
          onInput={(e) => setText(e.currentTarget.value)}
        />
        {error && <p class="field__error">{error}</p>}
      </div>
      <div class="field">
        <label class="label" for="waste-amount">
          How much
        </label>
        <input
          class="input"
          id="waste-amount"
          inputMode="decimal"
          value={amount}
          onInput={(e) => setAmount(e.currentTarget.value)}
        />
      </div>
      <ChipChoice
        label="Unit"
        choices={UNIT_CHOICES.map((u) => ({ value: u, label: u === 'portion' ? 'portions' : u }))}
        value={unit}
        onChange={(u) => u && setUnit(u)}
      />
      <ChipChoice
        label="Why"
        choices={(reasons ?? []).filter((r) => !r.hidden).map((r) => ({ value: r.id, label: r.name }))}
        value={reasonId}
        onChange={setReasonId}
        allowNone
      />
      <button class="button" type="submit" data-variant="primary" disabled={!text.trim()}>
        Log waste
      </button>
    </form>
  );
}

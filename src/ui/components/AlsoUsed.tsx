/**
 * Section admin pieces shown on other screens (A1, A9):
 * - ComponentCostView: what a batch costs, per unit, and what isn't priced;
 * - DishCostView: cost per portion and GP on each menu, against target;
 * - AlsoUsedNote: a quiet line about where else something is used, with at
 *   most a prompt to tell someone.
 */

import { formatPence } from '../../core/costing/costing';
import { componentCost, dishCost, menuGps } from '../../data/costing';
import { addHeadsUp, alsoUsedElsewhere, remindMe } from '../../data/elsewhere';
import type { Id, KitchenId } from '../../data/types';
import { formatAmount } from '../../core/scaling/rounding';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { trackSave } from '../saveStatus';
import { showMessage } from './UndoBar';

export function ComponentCostView({ componentId, kitchenId }: { componentId: Id; kitchenId: KitchenId }) {
  const cost = useLiveQuery(() => componentCost(componentId, kitchenId), [componentId, kitchenId]);
  if (!cost) return null;
  return (
    <section class="flow" aria-labelledby="cost-title">
      <h2 id="cost-title">Cost</h2>
      <p>
        {formatPence(cost.batch)} a batch
        {cost.yield && cost.perUnit !== null ? ` · ${formatPence(cost.perUnit * (cost.yield.unit === 'ml' || cost.yield.unit === 'g' ? 100 : 1))} per ${cost.yield.unit === 'ml' || cost.yield.unit === 'g' ? `100${cost.yield.unit}` : cost.yield.unit} (makes ${formatAmount(cost.yield.amount, cost.yield.unit)})` : ''}
      </p>
      {cost.missing.length > 0 && <p class="field__hint">Not costed: {cost.missing.join(', ')}. Add prices on the ingredients’ products.</p>}
    </section>
  );
}

export function DishCostView({ dishId, kitchenId }: { dishId: Id; kitchenId: KitchenId }) {
  const cost = useLiveQuery(() => dishCost(dishId, kitchenId), [dishId, kitchenId]);
  const gps = useLiveQuery(async () => (await menuGps(kitchenId)).filter((g) => g.dishId === dishId), [dishId, kitchenId]);
  if (!cost) return null;
  return (
    <section class="flow" aria-labelledby="dish-cost-title">
      <h2 id="dish-cost-title">Cost and GP</h2>
      <p>{formatPence(cost.perPortion)} a portion</p>
      {gps?.map((g) => (
        <p key={g.menuDishId} class={g.belowTarget ? 'plan-flag' : undefined}>
          {g.menuName}: {g.gp !== null ? `${g.gp}% GP` : 'no price set'}
          {g.target !== null ? ` (target ${g.target}%)` : ''}
          {g.belowTarget ? ': below target' : ''}
        </p>
      ))}
      {cost.missing.length > 0 && <p class="field__hint">Not costed: {cost.missing.join(', ')}.</p>}
      <p class="field__hint">GP from the menu price without VAT. Your working figures, not the kitchen’s records.</p>
    </section>
  );
}

/** "Chalk stream trout is also on Breakfast: eggs royale" (A9). At most a prompt; their call. */
export function AlsoUsedNote({ componentId, kitchenId }: { componentId: Id; kitchenId: KitchenId }) {
  const uses = useLiveQuery(() => alsoUsedElsewhere(componentId, kitchenId), [componentId, kitchenId]);
  if (!uses || uses.length === 0) return null;
  const summary = uses.map((u) => `${u.name} is also used for ${u.uses.join(', ')}`).join('; ');
  return (
    <div class="flow also-used" style={{ '--flow-space': 'var(--space-2xs)' }}>
      {uses.map((u) => (
        <p key={u.name} class="field__hint">
          {u.name} is also used for {u.uses.join(', ')}.
        </p>
      ))}
      <div class="cluster">
        <button
          class="button"
          type="button"
          data-variant="ghost"
          onClick={async () => {
            await trackSave(addHeadsUp(kitchenId, summary));
            showMessage('Heads-up added to tomorrow’s sheet.');
          }}
        >
          Heads-up on tomorrow’s sheet
        </button>
        <button
          class="button"
          type="button"
          data-variant="ghost"
          onClick={async () => {
            await trackSave(remindMe(summary));
            showMessage('Reminder in your inbox.');
          }}
        >
          Remind me to tell someone
        </button>
      </div>
    </div>
  );
}

/**
 * Section admin pieces shown on other screens (A9): a quiet line about where
 * else something is used, with at most a prompt to tell someone. Costs and
 * GP are only on the Money screen (DECISIONS 54).
 */

import { addHeadsUp, alsoUsedElsewhere, remindMe } from '../../data/elsewhere';
import type { Id, KitchenId } from '../../data/types';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { trackSave } from '../saveStatus';
import { showMessage } from './UndoBar';

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

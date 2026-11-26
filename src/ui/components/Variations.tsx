/**
 * Variations on a component page (V1, V2, V4, V5):
 * - chips under the name, the one in use here first; tap to see another;
 * - "Another way" to copy this one as your own, or start one from a book,
 *   another chef or an idea;
 * - an idea's note and "suggested to chef";
 * - logging an attempt; links to history and compare; deleting a variation.
 */

import { useLocation } from 'preact-iso';
import { useState } from 'preact/hooks';
import { toCalendarDate } from '../../core/time/calendar';
import { ListError } from '../../data/lists';
import { restoreSnapshot } from '../../data/snapshot';
import type { Id, KitchenId, Variation } from '../../data/types';
import { addAttempt, createVariation, deleteVariation, forkVariation, listVariations, setSuggestedToChef, setVariationNote } from '../../data/variations';
import { formatCalendarDate } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { ChipChoice } from './Controls';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

export function VariationChips({ componentId, kitchenId, shown }: { componentId: Id; kitchenId: KitchenId; shown: Variation }) {
  const variations = useLiveQuery(() => listVariations(componentId, kitchenId), [componentId, kitchenId]);
  const [adding, setAdding] = useState(false);
  const { route } = useLocation();
  if (!variations) return null;
  const inUse = variations.find((v) => v.inUse);
  const shownIsInUse = inUse?.variation.id === shown.id;

  async function add(kind: 'fork' | 'book' | 'idea', detail: string) {
    const id =
      kind === 'fork'
        ? await trackSave(forkVariation(shown.id))
        : await trackSave(createVariation(componentId, { source: kind, sourceDetail: detail.trim() || null }));
    setAdding(false);
    route(paths.componentVariation(componentId, id));
    showMessage(kind === 'fork' ? 'Copied as your own. The house recipe is unchanged.' : kind === 'idea' ? 'Idea added.' : 'Added. Write it in below.');
  }

  return (
    <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <div class="cluster" role="group" aria-label="Ways of making it" style={{ '--gutter': 'var(--space-2xs)' }}>
        {/* With one way of making it, the line under the chips already says whose it is. */}
        {variations.length > 1 && variations.map(({ variation, label, inUse }) => (
          <a
            key={variation.id}
            class="chip"
            aria-pressed={variation.id === shown.id}
            href={inUse ? paths.component(componentId) : paths.componentVariation(componentId, variation.id)}
          >
            {label}
            {inUse && variations.length > 1 ? ' ✓' : ''}
          </a>
        ))}
        <button class="chip reading-chip" type="button" data-empty="true" onClick={() => setAdding(true)}>
          + Another way
        </button>
      </div>
      {!shownIsInUse && inUse && <p class="field__hint">Not the one in use here: {inUse.label} is (✓). The sheet, plan and scaling use that one.</p>}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Another way of making it">
        {adding && <AddVariation onAdd={add} />}
      </Sheet>
    </div>
  );
}

function AddVariation({ onAdd }: { onAdd: (kind: 'fork' | 'book' | 'idea', detail: string) => void }) {
  const [kind, setKind] = useState<'fork' | 'book' | 'idea'>('fork');
  const [detail, setDetail] = useState('');
  return (
    <form
      class="flow"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(kind, detail);
      }}
    >
      <ChipChoice
        label="Start from…"
        choices={[
          { value: 'fork', label: 'A copy of this one, as my own' },
          { value: 'book', label: 'A book or another chef' },
          { value: 'idea', label: 'An idea' },
        ]}
        value={kind}
        onChange={(k) => k && setKind(k)}
      />
      {kind !== 'fork' && (
        <div class="field">
          <label class="label" for="variation-detail">
            {kind === 'book' ? 'Which book or chef?' : 'Where it came from (optional)'}
          </label>
          <input class="input" id="variation-detail" autocomplete="off" value={detail} placeholder={kind === 'book' ? 'Leiths, Chef Tom…' : 'staff food, a video…'} onInput={(e) => setDetail(e.currentTarget.value)} />
        </div>
      )}
      <p class="field__hint">{kind === 'fork' ? 'Experiment without losing what chef taught you: the original stays as it is.' : 'It starts empty: add ingredients and a method when you have them.'}</p>
      <button class="button" type="submit" data-variant="primary">
        Add
      </button>
    </form>
  );
}

/** An idea (V5): the idea itself, and when it was suggested to chef with their response. */
export function IdeaFields({ variation }: { variation: Variation }) {
  const [note, setNote] = useState(variation.note);
  const [response, setResponse] = useState(variation.suggestedToChef?.response ?? '');
  const suggested = variation.suggestedToChef;
  return (
    <section class="card" aria-labelledby="idea-title">
      <div class="card__body flow">
        <h2 id="idea-title">The idea</h2>
        <textarea
          class="textarea"
          aria-label="The idea"
          rows={3}
          value={note}
          placeholder="Brown the butter first; finish with lemon"
          onInput={(e) => setNote(e.currentTarget.value)}
          onBlur={() => note !== variation.note && trackSave(setVariationNote(variation.id, note))}
        />
        {suggested ? (
          <>
            <p>Suggested to chef on {formatCalendarDate(suggested.on)}.</p>
            <div class="field">
              <label class="label" for="chef-response">
                What chef said
              </label>
              <input
                class="input"
                id="chef-response"
                autocomplete="off"
                value={response}
                onInput={(e) => setResponse(e.currentTarget.value)}
                onBlur={() => trackSave(setSuggestedToChef(variation.id, { on: suggested.on, response: response.trim() || null }))}
              />
            </div>
            <button class="button" type="button" data-variant="ghost" onClick={() => trackSave(setSuggestedToChef(variation.id, null))}>
              Not suggested after all
            </button>
          </>
        ) : (
          <button class="button" type="button" onClick={() => trackSave(setSuggestedToChef(variation.id, { on: toCalendarDate(new Date()), response: null }))}>
            I suggested it to chef today
          </button>
        )}
        <p class="field__hint">Nothing is ever suggested to anyone by the app.</p>
      </div>
    </section>
  );
}

/** "Log an attempt" (V2): a dated note on this variation, shown with the component's notes. */
export function AttemptLog({ componentId, variationId, kitchenId }: { componentId: Id; variationId: Id; kitchenId: KitchenId }) {
  const [text, setText] = useState('');
  return (
    <form
      class="input-group"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        await trackSave(addAttempt(componentId, variationId, text, kitchenId));
        setText('');
        showMessage('Attempt logged, with today’s date.');
      }}
    >
      <input class="input" aria-label="Log an attempt" placeholder="Log an attempt: too sharp, cut vinegar 10%" autocomplete="off" value={text} onInput={(e) => setText(e.currentTarget.value)} />
      <button class="button" type="submit" disabled={!text.trim()}>
        Log
      </button>
    </form>
  );
}

/** History, compare, delete: what you can do with the variation shown. */
export function VariationActions({ componentId, kitchenId, shown }: { componentId: Id; kitchenId: KitchenId; shown: Variation }) {
  const variations = useLiveQuery(() => listVariations(componentId, kitchenId), [componentId, kitchenId]);
  const { route } = useLocation();
  const other = variations?.find((v) => v.variation.id !== shown.id);

  async function remove() {
    try {
      const snapshot = await deleteVariation(shown.id);
      route(paths.component(componentId));
      showMessage('Deleted that way of making it.', () => restoreSnapshot(snapshot));
    } catch (e) {
      showMessage(e instanceof ListError ? e.message : 'Couldn’t delete it.');
    }
  }

  return (
    <div class="cluster">
      <a class="button" href={paths.componentHistory(componentId, shown.id)}>
        History
      </a>
      {other && (
        <a class="button" href={paths.componentCompare(componentId, shown.id, other.variation.id)}>
          Compare
        </a>
      )}
      {(variations?.length ?? 0) > 1 && (
        <button class="button" type="button" data-variant="ghost" onClick={remove}>
          Delete this way
        </button>
      )}
    </div>
  );
}

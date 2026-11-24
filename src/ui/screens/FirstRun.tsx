import { useState } from 'preact/hooks';
import { completeFirstRun } from '../../data/firstRun';
import { createKitchen, listSections, setPlace, setUsualSection } from '../../data/kitchens';
import { addListItem, ListError } from '../../data/lists';
import type { Id } from '../../data/types';
import { ChipChoice } from '../components/Controls';
import { useLiveQuery } from '../hooks/useLiveQuery';

/**
 * First run (F1, UX → First run): two screens at most, both skippable.
 * 1. "Where do you work?": name a kitchen, or no kitchen.
 * 2. "Your usual section": pick one (or add your kitchen's word for it).
 * Then a line about backups, and on to Today. Persistent storage is asked
 * for on every start (src/data/startup.ts).
 */
export function FirstRun({ onDone }: { onDone: () => void }) {
  const [kitchenId, setKitchenId] = useState<Id | null>(null);

  async function finish() {
    await completeFirstRun();
    onDone();
  }

  return (
    <main class="first-run flow">
      {kitchenId ? <UsualSection kitchenId={kitchenId} onDone={finish} /> : <WhereDoYouWork onKitchen={setKitchenId} onSkip={finish} />}
    </main>
  );
}

function WhereDoYouWork({ onKitchen, onSkip }: { onKitchen: (id: Id) => void; onSkip: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function submit(event: Event) {
    event.preventDefault();
    try {
      const id = await createKitchen(name);
      await setPlace(id, null);
      onKitchen(id);
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t save that.');
    }
  }

  return (
    <form class="flow" onSubmit={submit}>
      <h1>Where do you work?</h1>
      <p>Name the kitchen you’re in. You can add others later, or use Mep with no kitchen at all.</p>
      <div class="field">
        <label class="label" for="first-kitchen">
          Kitchen
        </label>
        <input
          class="input"
          id="first-kitchen"
          value={name}
          autocomplete="off"
          placeholder="e.g. Dumbleton Hall"
          onInput={(e) => setName(e.currentTarget.value)}
        />
        {error && <p class="field__error">{error}</p>}
      </div>
      <button class="button" type="submit" data-variant="primary" disabled={!name.trim()}>
        Continue
      </button>
      <button class="button" type="button" data-variant="ghost" onClick={onSkip}>
        No kitchen for now
      </button>
    </form>
  );
}

function UsualSection({ kitchenId, onDone }: { kitchenId: Id; onDone: () => void }) {
  const sections = useLiveQuery(() => listSections(kitchenId), [kitchenId]);
  const [chosen, setChosen] = useState<Id | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  async function choose(id: Id | null) {
    setChosen(id);
    await setUsualSection(kitchenId, id);
    await setPlace(kitchenId, id);
  }

  async function add(event: Event) {
    event.preventDefault();
    try {
      const id = await addListItem({ kind: 'sections', kitchenId }, newName);
      setNewName('');
      setError('');
      await choose(id);
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add that.');
    }
  }

  return (
    <div class="flow">
      <h1>Your usual section</h1>
      <p>Mep opens on it. Your kitchen calls it something else? Add its name.</p>
      <ChipChoice
        label="Section"
        choices={(sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
        value={chosen}
        onChange={choose}
        allowNone
      />
      <form class="field" onSubmit={add}>
        <label class="label" for="first-section">
          Another section
        </label>
        <div class="input-group">
          <input class="input" id="first-section" value={newName} autocomplete="off" onInput={(e) => setNewName(e.currentTarget.value)} />
          <button class="button" type="submit" disabled={!newName.trim()}>
            Add
          </button>
        </div>
        {error && <p class="field__error">{error}</p>}
      </form>
      <p class="field__hint">Your notebook lives only on this phone. Mep will remind you to back it up.</p>
      <button class="button" type="button" data-variant="primary" onClick={onDone}>
        {chosen ? 'Done' : 'Skip'}
      </button>
    </div>
  );
}

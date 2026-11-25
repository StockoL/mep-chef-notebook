import { useState } from 'preact/hooks';
import { completeFirstRun } from '../../data/firstRun';
import { createKitchen, setPlace } from '../../data/kitchens';
import { ListError } from '../../data/lists';

/**
 * First run (F1, UX → First run): one screen, skippable. "Where do you
 * work?": name a kitchen, or no kitchen. Then on to Today. Which section
 * you're on isn't asked (DECISIONS 48). Persistent storage is asked for on
 * every start (src/data/startup.ts).
 */
export function FirstRun({ onDone }: { onDone: () => void }) {
  async function finish() {
    await completeFirstRun();
    onDone();
  }

  return (
    <main class="first-run flow">
      <WhereDoYouWork onDone={finish} />
    </main>
  );
}

function WhereDoYouWork({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function submit(event: Event) {
    event.preventDefault();
    try {
      const id = await createKitchen(name);
      await setPlace(id);
      onDone();
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
      <button class="button" type="button" data-variant="ghost" onClick={onDone}>
        No kitchen for now
      </button>
    </form>
  );
}

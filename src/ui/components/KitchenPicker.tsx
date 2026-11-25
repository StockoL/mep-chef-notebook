import { useState } from 'preact/hooks';
import { createKitchen, getPlace, listKitchens, setPlace } from '../../data/kitchens';
import { ListError } from '../../data/lists';
import { NO_KITCHEN_ID } from '../../data/types';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { showMessage } from './UndoBar';

/**
 * Switching kitchen (K1), from the ••• menu: the kitchens you work in, and a
 * new one. Which section you're on isn't asked (DECISIONS 48).
 */
export function KitchenPicker({ onChosen }: { onChosen: () => void }) {
  const place = useLiveQuery(() => getPlace());
  const kitchens = useLiveQuery(() => listKitchens());
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  if (!place || !kitchens) return null;

  async function addKitchen(event: Event) {
    event.preventDefault();
    try {
      const id = await createKitchen(newName);
      await setPlace(id);
      showMessage(`Added ${newName.trim()}. You’re there now.`);
      setNewName('');
      setError('');
      onChosen();
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add that kitchen.');
    }
  }

  return (
    <>
      <ul class="row-list" role="list" aria-label="Kitchen">
        {kitchens
          .filter((k) => !k.archived)
          .map((kitchen) => (
            <li key={kitchen.id}>
              <button
                class="list-row"
                type="button"
                aria-pressed={kitchen.id === place.kitchenId}
                onClick={async () => {
                  await setPlace(kitchen.id);
                  showMessage(kitchen.id === NO_KITCHEN_ID ? 'No kitchen for now.' : `You’re at ${kitchen.name}.`);
                  onChosen();
                }}
              >
                <span class="list-row__main">
                  <span class="list-row__title">{kitchen.name}</span>
                </span>
                {kitchen.id === place.kitchenId && <Icon name="tick" />}
              </button>
            </li>
          ))}
      </ul>
      <form class="input-group" onSubmit={addKitchen}>
        <input class="input" aria-label="New kitchen" value={newName} autocomplete="off" placeholder="New kitchen" onInput={(e) => setNewName(e.currentTarget.value)} />
        <button class="button" type="submit" disabled={!newName.trim()}>
          Add
        </button>
      </form>
      {error && <p class="field__error">{error}</p>}
    </>
  );
}

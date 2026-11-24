import { useState } from 'preact/hooks';
import { createKitchen, getPlaceDetails, listKitchens, listSections, setPlace } from '../../data/kitchens';
import { ListError } from '../../data/lists';
import { NO_KITCHEN_ID } from '../../data/types';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { ChipChoice } from './Controls';
import { Sheet } from './Sheet';

/**
 * "Where are you today?" (K1, MS3): switch kitchen or section from the top bar.
 * Switching section: tap the top bar → tap a section (2 taps; the sheet closes).
 */
export function WhereSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Where are you today?">
      <WhereBody onClose={onClose} />
    </Sheet>
  );
}

function WhereBody({ onClose }: { onClose: () => void }) {
  const details = useLiveQuery(() => getPlaceDetails());
  const kitchens = useLiveQuery(() => listKitchens());
  const kitchenId = details?.place.kitchenId;
  const sections = useLiveQuery(async () => (kitchenId ? listSections(kitchenId) : []), [kitchenId]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  if (!details || !kitchens) return null;

  async function addKitchen(event: Event) {
    event.preventDefault();
    try {
      const id = await createKitchen(newName);
      await setPlace(id, null);
      setNewName('');
      setError('');
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add that kitchen.');
    }
  }

  async function chooseSection(sectionId: string | null) {
    await setPlace(details!.place.kitchenId, sectionId);
    onClose();
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
                aria-pressed={kitchen.id === kitchenId}
                onClick={() => setPlace(kitchen.id)}
              >
                <span class="list-row__main">
                  <span class="list-row__title">{kitchen.name}</span>
                </span>
                {kitchen.id === kitchenId && <Icon name="tick" />}
              </button>
            </li>
          ))}
      </ul>

      {kitchenId !== NO_KITCHEN_ID && sections && sections.length > 0 && (
        <ChipChoice
          label="Section"
          choices={sections.map((s) => ({ value: s.id, label: s.name }))}
          value={details.place.sectionId}
          onChange={chooseSection}
          allowNone
        />
      )}

      <form class="field" onSubmit={addKitchen}>
        <label class="label" for="new-kitchen">
          New kitchen
        </label>
        <div class="input-group">
          <input
            class="input"
            id="new-kitchen"
            value={newName}
            autocomplete="off"
            placeholder="Kitchen name"
            onInput={(e) => setNewName(e.currentTarget.value)}
          />
          <button class="button" type="submit" disabled={!newName.trim()}>
            Add
          </button>
        </div>
        {error && <p class="field__error">{error}</p>}
      </form>

      <div class="cluster">
        {kitchenId && kitchenId !== NO_KITCHEN_ID && (
          <a class="button" href={paths.kitchen(kitchenId)} onClick={onClose}>
            Kitchen settings
          </a>
        )}
        <a class="button" href={paths.kitchens} onClick={onClose}>
          All kitchens
        </a>
      </div>
    </>
  );
}

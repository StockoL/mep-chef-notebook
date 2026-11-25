import { deleteWord, equipmentNames, listWords, restoreWord } from '../../data/steps';
import { ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

const MODE_LABELS = { active: 'active', 'check-in': 'check-in', passive: 'passive' } as const;

/**
 * The step reader's word list (P2, UX → Settings): the chef's corrections,
 * applied to every step read after them and exported with the data.
 */
export function WordList() {
  const words = useLiveQuery(() => listWords());
  const names = useLiveQuery(() => equipmentNames());

  async function forget(id: string, word: string) {
    const entry = await trackSave(deleteWord(id));
    if (entry) showMessage(`Forgot “${word}”.`, () => restoreWord(entry));
  }

  return (
    <section class="flow">
      <ScreenHeader title="Step reader’s words" back={{ href: paths.settings, label: 'Settings' }} />
      <p class="field__hint">
        When you correct a step’s kind or equipment, Mep remembers what the word means and reads it that way next time. Steps already read keep their readings.
      </p>
      {words?.length === 0 && (
        <div class="empty-state">
          <p>No corrections yet. Tap a chip under a step to correct it.</p>
        </div>
      )}
      <ul class="row-list" role="list">
        {words?.map((entry) => (
          <li key={entry.id} class="list-row">
            <span class="list-row__main">
              <span class="list-row__title">{entry.word}</span>
              <span class="list-row__meta">
                {[entry.mode ? MODE_LABELS[entry.mode] : null, entry.equipmentTypeId ? names?.get(entry.equipmentTypeId) : null].filter(Boolean).join(' · ')}
              </span>
            </span>
            <button class="button" type="button" data-variant="ghost" onClick={() => forget(entry.id, entry.word)}>
              Forget
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { useState } from 'preact/hooks';
import { getBackupStatus, REMINDER_CHOICES, setReminderDays, type ReminderDays } from '../../data/backup';
import { importData, ImportError } from '../../data/importData';
import { checkPersistence, getStorageEstimate, readMarker, writeMarker } from '../../data/storage';
import { exportBackup } from '../backupActions';
import { Segmented } from '../components/Controls';
import { ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { formatDaysAgo } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { usePromise } from '../hooks/usePromise';
import { Icon } from '../icons';
import { isInstalled } from '../platform';
import { paths } from '../router';
import { getTheme, setTheme, type ThemeChoice } from '../theme';

/** The chef's own lists, edited here (kitchen lists are in kitchen settings). */
const CHEF_LISTS = [
  { list: 'waste-reasons', label: 'Waste reasons' },
  { list: 'component-types', label: 'Component types' },
  { list: 'technique-categories', label: 'Technique categories' },
] as const;

/** App settings (F3, D1, D2; UX → App settings). */
export function Settings() {
  const backup = useLiveQuery(() => getBackupStatus());
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme);

  function chooseTheme(choice: ThemeChoice) {
    setTheme(choice);
    setThemeState(choice);
  }

  async function onImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again still fires
    if (!file) return;
    // Replacing everything can't be undone, so this is the one place to confirm (UX rule 3).
    if (!confirm('Replace everything in Mep with this backup? What’s on this phone now will be lost.')) return;
    try {
      await importData(new Uint8Array(await file.arrayBuffer()));
      showMessage(`Imported ${file.name}.`);
    } catch (error) {
      showMessage(error instanceof ImportError ? error.message : 'Import failed: the file couldn’t be read.');
    }
  }

  return (
    <section class="flow">
      <ScreenHeader title="App settings" />

      <section class="card" aria-labelledby="backup-title">
        <div class="card__body flow">
          <h2 id="backup-title">Backup</h2>
          <p>
            Your notebook is only on this phone.{' '}
            {backup?.lastBackupAt
              ? `Last backup ${formatDaysAgo(backup.daysSince ?? 0)}.`
              : 'It hasn’t been backed up yet.'}
          </p>
          <button class="button" type="button" data-variant="primary" onClick={exportBackup}>
            Back up now
          </button>
          <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
            <p class="label">Remind me to back up</p>
            {backup && (
              <Segmented<ReminderDays>
                label="Remind me to back up"
                choices={REMINDER_CHOICES.map((days) => ({
                  value: days,
                  label: days === 1 ? 'Daily' : days === 7 ? 'Weekly' : `Every ${days} days`,
                }))}
                value={backup.everyDays}
                onChange={setReminderDays}
              />
            )}
          </div>
          <label class="button">
            Import a backup…
            <input class="visually-hidden" type="file" accept=".zip,application/zip" onChange={onImport} />
          </label>
          <p class="field__hint">Importing replaces everything on this phone with the backup.</p>
        </div>
      </section>

      <section class="card" aria-labelledby="appearance-title">
        <div class="card__body flow">
          <h2 id="appearance-title">Appearance</h2>
          <Segmented<ThemeChoice>
            label="Dark mode"
            choices={[
              { value: 'auto', label: 'Follow phone' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={theme}
            onChange={chooseTheme}
          />
          <p class="field__hint">
            Text size follows your phone: Settings → Display &amp; Brightness → Text Size.
          </p>
        </div>
      </section>

      <section class="flow" aria-labelledby="lists-title">
        <h2 id="lists-title">Your lists</h2>
        <ul class="row-list" role="list">
          {CHEF_LISTS.map(({ list, label }) => (
            <li key={list}>
              <a class="list-row" href={paths.settingsList(list)}>
                <span class="list-row__main">
                  <span class="list-row__title">{label}</span>
                </span>
                <Icon name="chevron-right" />
              </a>
            </li>
          ))}
        </ul>
        <p class="field__hint">A kitchen’s own lists (sections, services) are in its kitchen settings.</p>
      </section>

      <StorageCheck />

      <p class="field__hint">
        About your data: everything stays on this phone. No account, no server. Mep {__APP_VERSION__}.
      </p>
    </section>
  );
}

/**
 * Whether the phone has promised to keep Mep's data, and the test marker
 * (Phase 0: does the data survive days unused?).
 */
function StorageCheck() {
  // Asking writes the answer to settings, so it can't be a live query (those only read).
  const persistence = usePromise(() => checkPersistence());
  const estimate = usePromise(() => getStorageEstimate());
  const marker = useLiveQuery(() => readMarker());

  return (
    <section class="card" aria-labelledby="storage-title">
      <div class="card__body flow">
        <h2 id="storage-title">Storage</h2>
        <dl class="details-list">
          <dt>Opened from</dt>
          <dd>{isInstalled() ? 'Home Screen' : 'Browser tab'}</dd>
          <dt>Kept safe by the phone</dt>
          <dd>{persistence === undefined ? '…' : !persistence.supported ? 'Not supported' : persistence.persisted ? 'Yes' : 'No'}</dd>
          <dt>Space used</dt>
          <dd>{estimate ? formatBytes(estimate.usage) : 'Unknown'}</dd>
          <dt>Test marker</dt>
          <dd>{marker ? new Date(marker).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not written'}</dd>
        </dl>
        <button class="button" type="button" onClick={() => writeMarker()}>
          Write test marker
        </button>
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

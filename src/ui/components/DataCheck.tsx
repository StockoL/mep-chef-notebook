import { useEffect, useState } from 'preact/hooks';
import { exportData } from '../../data/exportData';
import { exportFileName } from '../../data/exportFormat';
import { importData, ImportError } from '../../data/importData';
import {
  checkPersistence,
  getStorageEstimate,
  readMarker,
  writeMarker,
  type PersistenceRecord,
} from '../../data/storage';
import { isInstalled } from '../platform';
import { saveFile } from '../saveFile';

/**
 * TEMPORARY (Phase 0): checks for the phone. Shows whether storage is
 * persisted, writes the marker for the "still there after a few days" test,
 * and runs export and import. Phase 1 moves export and import to App
 * settings and removes this panel.
 */
export function DataCheck() {
  const [persistence, setPersistence] = useState<PersistenceRecord>();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [marker, setMarker] = useState<string>();
  const [message, setMessage] = useState('');

  async function refresh() {
    // Checking (not just reading) means the answer is here even if the
    // startup check hasn't finished yet. It's cheap and safe to repeat.
    setPersistence(await checkPersistence());
    setEstimate(await getStorageEstimate());
    setMarker(await readMarker());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onWriteMarker() {
    setMarker(await writeMarker());
  }

  async function onExport() {
    const saved = await saveFile(await exportData(), exportFileName(), 'application/zip');
    setMessage(saved ? 'Exported.' : 'Export cancelled.');
  }

  async function onImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again still fires
    if (!file) return;
    // Replacing everything can't be undone, so this is the one place to confirm (UX rule 3).
    if (!confirm('Replace everything in Mep with this export? This can’t be undone.')) return;
    try {
      await importData(new Uint8Array(await file.arrayBuffer()));
      setMessage(`Imported ${file.name}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof ImportError ? error.message : 'Import failed: the file couldn’t be read.');
    }
  }

  return (
    <section class="card" aria-labelledby="data-check-title">
      <div class="card__body flow">
        <h2 id="data-check-title">Phase 0 check</h2>
        <dl class="flow">
          <div>
            <dt>Opened from</dt>
            <dd>{isInstalled() ? 'Home Screen (installed)' : 'Browser tab'}</dd>
          </div>
          <div>
            <dt>Storage kept safe (persisted)</dt>
            <dd>
              {persistence === undefined
                ? '…'
                : !persistence.supported
                  ? 'Not supported here'
                  : `${persistence.persisted ? 'Yes' : 'No'} (first asked ${formatWhen(persistence.firstAskedAt)}: ${persistence.firstResult ? 'yes' : 'no'})`}
            </dd>
          </div>
          <div>
            <dt>Space used</dt>
            <dd>{estimate ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)}` : 'Unknown'}</dd>
          </div>
          <div>
            <dt>Test marker</dt>
            <dd>{marker ? `Written ${formatWhen(marker)}` : 'Not written yet'}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{__APP_VERSION__}</dd>
          </div>
        </dl>
        <div class="cluster">
          <button class="button" type="button" onClick={onWriteMarker}>
            Write marker
          </button>
          <button class="button" type="button" data-variant="primary" onClick={onExport}>
            Export
          </button>
          <label class="button">
            Import…
            <input class="visually-hidden" type="file" accept=".zip,application/zip" onChange={onImport} />
          </label>
        </div>
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}

function formatWhen(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

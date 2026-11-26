import { useLocation } from 'preact-iso';
import { useState } from 'preact/hooks';
import { getPlace } from '../../data/kitchens';
import { getComponentDetails } from '../../data/library';
import type { Id } from '../../data/types';
import { compareVariations, listVariations } from '../../data/variations';
import { getVersionContent, listVersions, restoreVersion, setVersionNote, undoRestore } from '../../data/versions';
import { ChipChoice } from '../components/Controls';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { showMessage } from '../components/UndoBar';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

const when = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * A variation's history (V3): /library/component/:id/history?v=…
 * Every editing session is a version; tap one to see it as it was and
 * restore it. Restoring never loses anything: it becomes a new version.
 */
export function ComponentHistory({ id = '' }: { id?: string }) {
  const { query } = useLocation();
  const variationId = query.v ?? '';
  const place = useLiveQuery(() => getPlace());
  const details = useLiveQuery(async () => (place ? getComponentDetails(id, place.kitchenId, undefined, variationId) : undefined), [id, place?.kitchenId, variationId]);
  const versions = useLiveQuery(() => listVersions(variationId), [variationId]);
  const [open, setOpen] = useState<Id | null>(null);
  const back = { href: paths.componentVariation(id, variationId), label: details?.component.name ?? 'Recipe' };

  return (
    <section class="flow">
      <ScreenHeader title="History" back={back} />
      <p class="field__hint">A new version is kept each time you come back to edit (after half an hour away). Tap one to see it as it was.</p>
      <ul class="row-list" role="list">
        {versions?.map(({ version, isCurrent, changes }) => (
          <li key={version.id}>
            <button class="list-row" type="button" onClick={() => setOpen(version.id)}>
              <span class="list-row__main">
                <span class="list-row__title">
                  {when(version.createdAt)}
                  {isCurrent ? ' · now' : ''}
                </span>
                <span class="list-row__meta">{[version.changeNote, changes].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? `Version from ${when(versions?.find((v) => v.version.id === open)?.version.createdAt ?? '')}` : ''}>
        {open && (
          <VersionView
            versionId={open}
            isCurrent={versions?.find((v) => v.version.id === open)?.isCurrent ?? false}
            onRestore={async () => {
              const { previousId, restoredId } = await trackSave(restoreVersion(variationId, open));
              setOpen(null);
              showMessage('Restored. The version before is kept in the history.', () => undoRestore(variationId, previousId, restoredId));
            }}
          />
        )}
      </Sheet>
    </section>
  );
}

function VersionView({ versionId, isCurrent, onRestore }: { versionId: Id; isCurrent: boolean; onRestore: () => void }) {
  const content = useLiveQuery(() => getVersionContent(versionId), [versionId]);
  const [note, setNote] = useState<string | null>(null);
  if (!content) return null;
  return (
    <>
      <ul class="line-rows" role="list" aria-label="Ingredients then">
        {content.lines.map((line, i) => (
          <li key={i}>
            <span class="line-rows__row">
              <span class="line-rows__quantity">{line.amount}</span>
              <span class="line-rows__name">
                {line.name}
                {line.prepNote && <span class="line-rows__note">, {line.prepNote}</span>}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {content.steps.length > 0 && (
        <ol class="flow">
          {content.steps.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ol>
      )}
      <div class="field">
        <label class="label" for="version-note">
          What changed, and why
        </label>
        <input
          class="input"
          id="version-note"
          autocomplete="off"
          placeholder="Less vinegar: too sharp"
          value={note ?? content.version.changeNote ?? ''}
          onInput={(e) => setNote(e.currentTarget.value)}
          onBlur={() => note !== null && trackSave(setVersionNote(versionId, note))}
        />
      </div>
      {!isCurrent && (
        <button class="button" type="button" data-variant="primary" onClick={onRestore}>
          Restore this version
        </button>
      )}
    </>
  );
}

/** Two ways of making it side by side (V4): /library/component/:id/compare?a=…&b=… */
export function ComponentCompare({ id = '' }: { id?: string }) {
  const { query, route } = useLocation();
  const place = useLiveQuery(() => getPlace());
  const variations = useLiveQuery(async () => (place ? listVariations(id, place.kitchenId) : []), [id, place?.kitchenId]);
  const a = query.a ?? '';
  const b = query.b ?? '';
  const compared = useLiveQuery(() => compareVariations(a, b), [a, b]);
  const label = (vid: string) => variations?.find((v) => v.variation.id === vid)?.label ?? '';
  const choices = (variations ?? []).map((v) => ({ value: v.variation.id, label: v.label }));

  return (
    <section class="flow">
      <ScreenHeader title="Compare" back={{ href: paths.component(id), label: 'Recipe' }} />
      <ChipChoice label="Left" choices={choices} value={a} onChange={(v) => v && route(paths.componentCompare(id, v, b))} />
      <ChipChoice label="Right" choices={choices} value={b} onChange={(v) => v && route(paths.componentCompare(id, a, v))} />
      {compared && (
        <>
          <table class="compare">
            <thead>
              <tr>
                <th scope="col">Ingredient</th>
                <th scope="col">{label(a)}</th>
                <th scope="col">{label(b)}</th>
              </tr>
            </thead>
            <tbody>
              {compared.rows.map((row) => (
                <tr key={row.name} data-differs={row.differs}>
                  <th scope="row">{row.name}</th>
                  <td>{row.a ?? '–'}</td>
                  <td>{row.b ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="field__hint">Differences are highlighted.</p>
          <div class="compare-methods">
            {[
              { title: label(a), steps: compared.stepsA },
              { title: label(b), steps: compared.stepsB },
            ].map((side, index) => (
              <section key={index} class="flow">
                <h2 class="section-label">{side.title}: method</h2>
                {side.steps.length ? (
                  <ol>
                    {side.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                ) : (
                  <p class="field__hint">No method yet.</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

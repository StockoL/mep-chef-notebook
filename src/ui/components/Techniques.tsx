/**
 * Techniques on screen (T1–T3):
 * - TechniqueText: a step's text with technique words underlined; tap one
 *   and the technique opens as a sheet over the recipe; closing it leaves
 *   you exactly where you were (one tap there, one tap back).
 * - TemplatePicker: "Use a template" for a method (T3).
 * - SaveTemplate: keep a method as a template for a technique.
 */

import { useState } from 'preact/hooks';
import { findMentions } from '../../core/techniques/mentions';
import { getPlace } from '../../data/kitchens';
import { ListError } from '../../data/lists';
import type { Id } from '../../data/types';
import { applyTemplate, getTechniqueDetails, hasOwnNotes, listTechniques, listTemplates, namesNotTechniques, saveAsTemplate } from '../../data/techniques';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { MediaView } from './MediaView';
import { announceStatus } from './MethodEditor';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

/** Text with its technique words as links that open the technique over the page. */
export function TechniqueText({ text }: { text: string }) {
  const techniques = useLiveQuery(() => listTechniques());
  const notWithin = useLiveQuery(() => namesNotTechniques());
  const [open, setOpen] = useState<Id | null>(null);
  const pieces = findMentions(text, techniques ?? [], notWithin ?? []);
  const name = techniques?.find((t) => t.id === open)?.name ?? '';
  return (
    <>
      {pieces.map((piece, i) =>
        piece.techniqueId ? (
          <button key={i} class="technique-link" type="button" onClick={() => setOpen(piece.techniqueId)}>
            {piece.text}
          </button>
        ) : (
          <span key={i}>{piece.text}</span>
        ),
      )}
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={name}>
        {open && <TechniqueSummary id={open} />}
      </Sheet>
    </>
  );
}

/** A technique at a glance: this kitchen's note first, then your notes, mistakes and variants. */
function TechniqueSummary({ id }: { id: Id }) {
  const place = useLiveQuery(() => getPlace());
  const details = useLiveQuery(async () => (place ? getTechniqueDetails(id, place.kitchenId) : undefined), [id, place?.kitchenId]);
  if (!details) return null;
  const { technique, variants, kitchenNote } = details;
  const empty = !hasOwnNotes(technique) && variants.length === 0 && !kitchenNote;
  return (
    <>
      {kitchenNote && (
        <p class="technique-kitchen-note">
          <strong>Here:</strong> {kitchenNote.notes}
        </p>
      )}
      {technique.notes && <p class="prewrap">{technique.notes}</p>}
      {technique.mistakes && (
        <p class="prewrap">
          <strong>Watch out:</strong> {technique.mistakes}
        </p>
      )}
      {variants.map((v) => (
        <p key={v.id} class="prewrap">
          <strong>{v.context}:</strong> {v.notes}
        </p>
      ))}
      {technique.mediaIds.map((mediaId) => (
        <MediaView key={mediaId} id={mediaId} />
      ))}
      {empty && <p class="field__hint">No notes of your own yet. Add how you do it, in your own words.</p>}
      <a class="button" href={paths.technique(id)}>
        {empty ? 'Add your notes' : 'Open the full entry'}
      </a>
    </>
  );
}

// ─── Templates ────────────────────────────────────────────────────────────

/** Pick a method template: its steps go on the end of the method, read like anything typed (T3). */
export function TemplatePicker({ variationId, componentName, onDone }: { variationId: Id; componentName: string; onDone: () => void }) {
  const templates = useLiveQuery(() => listTemplates(componentName), [componentName]);
  const [preview, setPreview] = useState<Id | null>(null);

  async function apply(templateId: Id, name: string) {
    announceStatus(await trackSave(applyTemplate(variationId, templateId)));
    onDone();
    showMessage(`Added the ${name.toLowerCase()} method. Check the times, then Confirm all.`);
  }

  if (templates?.length === 0) return <p class="field__hint">No templates yet. Save a method as a template from any recipe.</p>;
  return (
    <>
      <p class="field__hint">Typical steps and times to start from. Correct them to how you do it.</p>
      <ul class="row-list" role="list">
        {templates?.map(({ template, techniqueName, suggested }) => (
          <li key={template.id}>
            <button class="list-row" type="button" aria-expanded={preview === template.id} onClick={() => setPreview(preview === template.id ? null : template.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{techniqueName}</span>
                <span class="list-row__meta">{[suggested ? 'Matches this recipe' : null, `${template.steps.length} steps`].filter(Boolean).join(' · ')}</span>
              </span>
              <Icon name={preview === template.id ? 'chevron-down' : 'chevron-right'} />
            </button>
            {preview === template.id && (
              <div class="flow template-preview">
                <ol>
                  {template.steps.map((s, i) => (
                    <li key={i}>{s.text}</li>
                  ))}
                </ol>
                <button class="button" type="button" data-variant="primary" onClick={() => apply(template.id, techniqueName)}>
                  Use this method
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Keep this method as a template for a technique (new or existing). */
export function SaveTemplate({ variationId, componentName, onDone }: { variationId: Id; componentName: string; onDone: () => void }) {
  const techniques = useLiveQuery(() => listTechniques());
  const [query, setQuery] = useState(componentName);
  const [error, setError] = useState('');
  const matches = (techniques ?? []).filter((t) => !query.trim() || t.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);

  async function save(technique: { id: Id } | { name: string }, name: string) {
    try {
      await trackSave(saveAsTemplate(variationId, technique));
      onDone();
      showMessage(`Saved as a template for ${name}.`);
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t save it.');
    }
  }

  return (
    <>
      <p class="field__hint">Which technique is it a method for? It’ll be offered when you start a recipe like it.</p>
      <input class="input" type="search" aria-label="Technique" value={query} autocomplete="off" onInput={(e) => setQuery(e.currentTarget.value)} />
      {query.trim() && !matches.some((t) => t.name.toLowerCase() === query.trim().toLowerCase()) && (
        <button class="button" type="button" data-variant="primary" onClick={() => save({ name: query }, query.trim())}>
          New technique “{query.trim()}”
        </button>
      )}
      <ul class="row-list" role="list">
        {matches.map((t) => (
          <li key={t.id}>
            <button class="list-row" type="button" onClick={() => save({ id: t.id }, t.name)}>
              <span class="list-row__main">
                <span class="list-row__title">{t.name}</span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
      {error && <p class="field__error">{error}</p>}
    </>
  );
}

/** "Sort into a technique" from the inbox: pick one, or name a new one. */
export function TechniquePicker({ onPick }: { onPick: (technique: { id: Id } | { name: string }) => void }) {
  const techniques = useLiveQuery(() => listTechniques());
  const [query, setQuery] = useState('');
  const matches = (techniques ?? []).filter((t) => !query.trim() || [t.name, ...t.aliases].some((n) => n.toLowerCase().includes(query.trim().toLowerCase()))).slice(0, 12);
  return (
    <>
      <input class="input" type="search" aria-label="Find a technique" placeholder="Find a technique" value={query} autocomplete="off" onInput={(e) => setQuery(e.currentTarget.value)} />
      {query.trim() && !matches.some((t) => t.name.toLowerCase() === query.trim().toLowerCase()) && (
        <button class="button" type="button" onClick={() => onPick({ name: query })}>
          New technique “{query.trim()}”
        </button>
      )}
      <ul class="row-list" role="list">
        {matches.map((t) => (
          <li key={t.id}>
            <button class="list-row" type="button" onClick={() => onPick({ id: t.id })}>
              <span class="list-row__main">
                <span class="list-row__title">{t.name}</span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}


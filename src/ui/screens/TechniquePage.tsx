import { useLocation } from 'preact-iso';
import { useEffect, useRef, useState } from 'preact/hooks';
import { getKitchen, getPlace } from '../../data/kitchens';
import { getListItems } from '../../data/lists';
import { restoreSnapshot } from '../../data/snapshot';
import {
  addTechniqueMedia,
  addVariant,
  deleteTechnique,
  deleteTemplate,
  deleteVariant,
  getTechniqueDetails,
  type TechniqueDetails,
  removeTechniqueMedia,
  setKitchenNote,
  updateTechnique,
  updateTemplateSteps,
  updateVariant,
} from '../../data/techniques';
import { NO_KITCHEN_ID, type MethodTemplate, type TechniqueVariant } from '../../data/types';
import { ChipChoice } from '../components/Controls';
import { AliasesField, NameField, TextAreaField } from '../components/LibraryEditors';
import { MediaView } from '../components/MediaView';
import { NoteEditor } from '../components/NoteEditor';
import { ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { useAutosave } from '../hooks/useAutosave';
import { useEditMode } from '../hooks/useEditMode';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { shrinkPhoto } from '../media';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

const BACK = { href: paths.library, label: 'Library' };

/**
 * A technique (SPEC → Techniques; T1, T2): the chef's own notes and common
 * mistakes, ways of doing it by context, this kitchen's note, photos or
 * video, method templates, notes sorted from the inbox, and where it's used
 * (worked out from steps and prep notes). /library/technique/:id
 */
export function TechniquePage({ id = '' }: { id?: string }) {
  const place = useLiveQuery(() => getPlace());
  const details = useLiveQuery(async () => (place ? getTechniqueDetails(id, place.kitchenId) : undefined), [id, place?.kitchenId]);
  const kitchen = useLiveQuery(async () => (place ? getKitchen(place.kitchenId) : undefined), [place?.kitchenId]);
  const categories = useLiveQuery(() => getListItems({ kind: 'values', list: 'technique-categories', kitchenId: null }));
  const [variantName, setVariantName] = useState('');
  const mediaInput = useRef<HTMLInputElement>(null);
  const { route } = useLocation();
  const { editing, start, done } = useEditMode();

  if (!details || !place) return <ScreenHeader title="" back={BACK} />;
  const { technique, variants, kitchenNote, templates, notes, usedIn } = details;

  async function onMedia(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    // Photos are shrunk like every other photo (DECISIONS 33); videos are kept as they are.
    await trackSave(addTechniqueMedia(id, file.type.startsWith('image/') ? await shrinkPhoto(file) : file));
  }

  async function remove() {
    const snapshot = await deleteTechnique(id);
    route(BACK.href);
    showMessage(`Deleted ${technique.name}.`, () => restoreSnapshot(snapshot));
  }

  if (!editing) {
    return (
      <TechniqueReading
        details={details}
        kitchenName={place.kitchenId !== NO_KITCHEN_ID ? (kitchen?.name ?? 'this kitchen') : null}
        categoryName={categories?.find((c) => c.id === technique.categoryId)?.name ?? null}
        onEdit={start}
      />
    );
  }

  return (
    <section class="flow" key={`${id}-edit`}>
      <ScreenHeader title={technique.name} back={BACK} action={{ label: 'Done', onClick: done }} />
      <NameField value={technique.name} onSave={(name) => updateTechnique(id, { name })} />
      <AliasesField aliases={technique.aliases} onSave={(aliases) => updateTechnique(id, { aliases })} />
      <ChipChoice
        label="Category"
        choices={(categories ?? []).filter((c) => !c.hidden || c.id === technique.categoryId).map((c) => ({ value: c.id, label: c.name }))}
        value={technique.categoryId}
        allowNone
        onChange={(categoryId) => trackSave(updateTechnique(id, { categoryId }))}
      />

      {place.kitchenId !== NO_KITCHEN_ID && (
        <TextAreaField
          id="kitchen-note"
          label={`At ${kitchen?.name ?? 'this kitchen'}`}
          value={kitchenNote?.notes ?? ''}
          placeholder="Three-sided quenelles here"
          onSave={(text) => setKitchenNote(id, place.kitchenId, text)}
        />
      )}
      <TextAreaField id="technique-notes" label="How you do it" value={technique.notes} placeholder="In your own words" onSave={(notes) => updateTechnique(id, { notes })} />
      <TextAreaField id="technique-mistakes" label="Common mistakes" value={technique.mistakes} placeholder="What goes wrong, and how to tell" onSave={(mistakes) => updateTechnique(id, { mistakes })} />

      <section class="flow" aria-labelledby="variants-title">
        <h2 id="variants-title">By context</h2>
        <p class="field__hint">When it’s done differently: “smooth mixes”, “textured mixes”.</p>
        {variants.map((v) => (
          <VariantEditor key={v.id} variant={v} />
        ))}
        <form
          class="input-group"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!variantName.trim()) return;
            await trackSave(addVariant(id, variantName));
            setVariantName('');
          }}
        >
          <input class="input" aria-label="New context" placeholder="textured mixes" autocomplete="off" value={variantName} onInput={(e) => setVariantName(e.currentTarget.value)} />
          <button class="button" type="submit" disabled={!variantName.trim()}>
            Add
          </button>
        </form>
      </section>

      <section class="flow" aria-labelledby="media-title">
        <h2 id="media-title">Photos and video</h2>
        {technique.mediaIds.map((mediaId) => (
          <div key={mediaId} class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
            <MediaView id={mediaId} />
            <button class="button" type="button" data-variant="ghost" onClick={() => trackSave(removeTechniqueMedia(id, mediaId))}>
              Remove
            </button>
          </div>
        ))}
        <button class="button" type="button" onClick={() => mediaInput.current?.click()}>
          <Icon name="camera" /> Add a photo or video
        </button>
        <input ref={mediaInput} class="visually-hidden" type="file" accept="image/*,video/*" tabIndex={-1} aria-hidden="true" onChange={onMedia} />
      </section>

      {templates.length > 0 && (
        <section class="flow" aria-labelledby="templates-title">
          <h2 id="templates-title">Method templates</h2>
          <p class="field__hint">Offered under Method → Use a template, on any recipe.</p>
          {templates.map((t) => (
            <TemplateEditor key={t.id} template={t} />
          ))}
        </section>
      )}

      {notes.length > 0 && (
        <section class="flow" aria-labelledby="technique-notes-title">
          <h2 id="technique-notes-title">Notes</h2>
          {notes.map((note) => (
            <div key={note.id} class="card">
              <div class="card__body">
                <NoteEditor note={note} />
              </div>
            </div>
          ))}
        </section>
      )}

      <section class="flow" aria-labelledby="used-title">
        <h2 id="used-title">Used in</h2>
        {usedIn.length === 0 ? (
          <p class="field__hint">No recipe mentions it yet. Mep finds it in steps and prep notes by name or alias.</p>
        ) : (
          <ul class="row-list" role="list">
            {usedIn.map((c) => (
              <li key={c.id}>
                <a class="list-row" href={paths.component(c.id)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{c.name}</span>
                  </span>
                  <Icon name="chevron-right" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Delete technique
      </button>
    </section>
  );
}

/**
 * A technique to read (FEEL_PASS 2): your notes, this kitchen's way, by
 * context, photos, templates, notes from the inbox, and where it's used.
 * Edit (top right) for the fields.
 */
function TechniqueReading({ details, kitchenName, categoryName, onEdit }: { details: TechniqueDetails; kitchenName: string | null; categoryName: string | null; onEdit: () => void }) {
  const { technique, variants, kitchenNote, templates, notes, usedIn } = details;
  const written = Boolean(technique.notes.trim() || technique.mistakes.trim() || kitchenNote?.notes.trim() || variants.some((v) => v.notes.trim()));
  const meta = [categoryName, technique.aliases.length ? `also ${technique.aliases.join(', ')}` : null].filter(Boolean).join(' · ');
  const block = (label: string, text: string | undefined) =>
    text?.trim() ? (
      <section class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
        <h2 class="section-label">{label}</h2>
        <p class="reading-text">{text}</p>
      </section>
    ) : null;
  return (
    <section class="flow" key={technique.id}>
      <ScreenHeader title={technique.name} back={BACK} action={{ label: 'Edit', onClick: onEdit }} meta={meta || undefined} />
      {!written && (
        <p class="field__hint">
          A name, waiting for your notes.{' '}
          <button class="link-button" type="button" onClick={onEdit}>
            Write how you do it
          </button>
        </p>
      )}
      {kitchenName && block(`At ${kitchenName}`, kitchenNote?.notes)}
      {block('How you do it', technique.notes)}
      {block('Common mistakes', technique.mistakes)}
      {variants.filter((v) => v.notes.trim()).map((v) => (
        <div key={v.id}>{block(v.context, v.notes)}</div>
      ))}
      {technique.mediaIds.map((mediaId) => (
        <MediaView key={mediaId} id={mediaId} />
      ))}
      {templates.length > 0 && (
        <section class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
          <h2 class="section-label">Method templates</h2>
          {templates.map((t) => (
            <ol key={t.id} class="reading-steps">
              {t.steps.map((step, i) => (
                <li key={i}>{step.text}</li>
              ))}
            </ol>
          ))}
        </section>
      )}
      {notes.length > 0 && (
        <section class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
          <h2 class="section-label">Notes</h2>
          {notes.map((note) => (
            <div key={note.id} class="card">
              <div class="card__body">
                <NoteEditor note={note} />
              </div>
            </div>
          ))}
        </section>
      )}
      <section class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
        <h2 class="section-label">Used in</h2>
        {usedIn.length === 0 ? (
          <p class="field__hint">No recipe mentions it yet.</p>
        ) : (
          <ul class="row-list" role="list">
            {usedIn.map((c) => (
              <li key={c.id}>
                <a class="list-row" href={paths.component(c.id)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{c.name}</span>
                  </span>
                  <Icon name="chevron-right" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function VariantEditor({ variant }: { variant: TechniqueVariant }) {
  return (
    <div class="card">
      <div class="card__body flow">
        <TextAreaField id={`variant-${variant.id}`} label={variant.context} value={variant.notes} placeholder="How it’s done here" onSave={(notes) => updateVariant(variant.id, { notes })} />
        <button
          class="button"
          type="button"
          data-variant="ghost"
          onClick={async () => {
            const removed = await deleteVariant(variant.id);
            if (removed) showMessage(`Removed “${variant.context}”.`, () => restoreSnapshot({ techniqueVariants: [removed] }));
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

/** A template's steps, one per line, edited like a method. */
function TemplateEditor({ template }: { template: MethodTemplate }) {
  const [text, setText] = useState(() => template.steps.map((s) => s.text).join('\n'));
  const { change, flush } = useAutosave((value: string) => updateTemplateSteps(template.id, value.split('\n')), 800);
  useEffect(() => () => void flush(), []);
  return (
    <div class="card">
      <div class="card__body flow">
        <textarea
          class="textarea"
          aria-label="Template steps"
          rows={Math.max(3, text.split('\n').length + 1)}
          value={text}
          onInput={(e) => {
            setText(e.currentTarget.value);
            change(e.currentTarget.value);
          }}
          onBlur={flush}
        />
        <button
          class="button"
          type="button"
          data-variant="ghost"
          onClick={async () => {
            const removed = await deleteTemplate(template.id);
            if (removed) showMessage('Template deleted.', () => restoreSnapshot({ methodTemplates: [removed] }));
          }}
        >
          Delete this template
        </button>
      </div>
    </div>
  );
}

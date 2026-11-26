/**
 * The method (P1–P3, SPEC → Confirming): steps written one per line in the
 * chef's shorthand, each shown with what the step reader got from it as
 * chips.
 *
 * - MethodSteps: the reading view (FEEL_PASS 2): numbered steps with their
 *   chips and technique links, nothing to type into. A missing reading
 *   ("+ time") opens edit mode.
 * - MethodEditor: edit mode. The whole method as one text box, saved as you
 *   type, with what the reader got directly underneath: tap a chip to
 *   correct it, "Looks right" confirms the step.
 */

import { useState } from 'preact/hooks';
import { STEP_MODES, type StepMode } from '../../core/parser/parseStep';
import { whatsMissing, type Missing } from '../../core/parser/readiness';
import { readTypedMinutes } from '../../core/parser/tokens';
import { formatMinuteRange } from '../../core/time/formatMinutes';
import { saveSteps } from '../../data/library';
import { confirmAllSteps, confirmStep, equipmentKitchenId, learnWord, listEquipment, unconfirmSteps, unlearnWord, updateStepPart, type StatusChange } from '../../data/steps';
import { addListItem, ListError } from '../../data/lists';
import type { Id, KitchenId, ListValue, Step, StepPart, Variation } from '../../data/types';
import { createTechnique } from '../../data/techniques';
import { getTargets } from '../../data/foodSafety';
import { criticalTarget } from '../../core/foodSafety/foodSafety';
import { useAutosave } from '../hooks/useAutosave';
import { paths } from '../router';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { trackSave } from '../saveStatus';
import { ChipChoice, ChipToggles } from './Controls';
import { Sheet } from './Sheet';
import { SaveTemplate, TechniqueText, TemplatePicker } from './Techniques';
import { showMessage } from './UndoBar';
import { Hint } from './Hint';

const MODE_LABELS: Record<StepMode, string> = { active: 'Active', 'check-in': 'Check-in', passive: 'Passive' };
const MODE_HINTS: Record<StepMode, string> = {
  active: 'Hands busy the whole time',
  'check-in': 'Hands-off, but needs a look every few minutes',
  passive: 'Left alone',
};

/** Says so when an edit drops a ready recipe back to draft (SPEC → Draft or ready). */
export function announceStatus(change: StatusChange | null) {
  if (!change || change.from === change.to) return;
  if (change.to === 'ready') showMessage('Ready: every step is complete and confirmed. It can go in the plan.');
  else showMessage(`Back to draft: ${change.missing[0]?.text ?? 'something is missing'}.`);
}

export function MethodEditor({ variation, steps, componentName }: { variation: Variation; steps: Step[]; componentName: string }) {
  // Bumped when a template rewrites the method, so the text box starts again from the saved steps.
  const [textKey, setTextKey] = useState(0);
  const [templates, setTemplates] = useState<'use' | 'save' | null>(null);
  const [open, setOpen] = useState<{ stepId: Id; part: number } | null>(null);
  const equipmentKitchen = useLiveQuery(() => equipmentKitchenId(variation), [variation.id, variation.kitchenId]);
  const equipment = useLiveQuery(async () => (equipmentKitchen ? listEquipment(equipmentKitchen) : []), [equipmentKitchen]);
  const targets = useLiveQuery(async () => (equipmentKitchen ? getTargets(equipmentKitchen) : {}), [equipmentKitchen]);
  const missing = whatsMissing(steps.map((s) => ({ ...s, parts: s.parts.map((p) => ({ ...p, equipment: p.equipmentTypeId })) })));
  const unconfirmed = steps.filter((s) => !s.confirmed).length;
  const openStep = open ? steps.find((s) => s.id === open.stepId) : undefined;

  async function confirmAll() {
    const { ids, change } = await trackSave(confirmAllSteps(variation.id));
    const ready = change?.to === 'ready' ? ' Ready: it can go in the plan.' : '';
    showMessage(`Confirmed ${ids.length} ${ids.length === 1 ? 'step' : 'steps'}.${ready}`, () => unconfirmSteps(ids, variation.id));
  }

  function fix(item: Missing) {
    if (item.field === 'method') document.getElementById('steps')?.focus();
    else if (steps[item.step]) setOpen({ stepId: steps[item.step]!.id, part: item.part ?? 0 });
  }

  return (
    <section class="flow" aria-labelledby="method-title">
      <div class="method-head">
        <h2 class="section-label" id="method-title">Method</h2>
        <button class="button" type="button" data-variant="ghost" onClick={() => setTemplates('use')}>
          Use a template
        </button>
      </div>

      <MethodText key={textKey} variationId={variation.id} steps={steps} />
      {/* What the step reader got, straight under the box: the box is the method, these are its readings. */}
      {steps.length > 0 && (
        <ol class="method-steps" role="list" aria-label="Steps as read">
          {steps.map((step, index) => (
            <StepCard key={step.id} step={step} number={index + 1} equipment={equipment ?? []} targets={targets ?? {}} onOpen={(part) => setOpen({ stepId: step.id, part })} />
          ))}
        </ol>
      )}
      {unconfirmed > 1 && (
        <button class="button" type="button" onClick={confirmAll}>
          Confirm all {unconfirmed} steps
        </button>
      )}
      {steps.length > 0 && (
        <button class="button" type="button" data-variant="ghost" onClick={() => setTemplates('save')}>
          Save this method as a template
        </button>
      )}

      <Sheet open={templates === 'use'} onClose={() => setTemplates(null)} title="Use a template">
        {templates === 'use' && (
          <TemplatePicker
            variationId={variation.id}
            componentName={componentName}
            onDone={() => {
              setTemplates(null);
              setTextKey((k) => k + 1);
            }}
          />
        )}
      </Sheet>
      <Sheet open={templates === 'save'} onClose={() => setTemplates(null)} title="Save as a template">
        {templates === 'save' && <SaveTemplate variationId={variation.id} componentName={componentName} onDone={() => setTemplates(null)} />}
      </Sheet>

      {variation.status === 'draft' && missing.length > 0 && (
        <MissingList missing={missing} onFix={fix} />
      )}

      <Sheet open={!!openStep} onClose={() => setOpen(null)} title={openStep ? `Step ${steps.indexOf(openStep) + 1}` : ''}>
        {openStep && open && (
          <PartEditor key={`${openStep.id}-${open.part}`} step={openStep} index={open.part} equipment={equipment ?? []} kitchenId={equipmentKitchen ?? null} onPart={(part) => setOpen({ stepId: openStep.id, part })} onDone={() => setOpen(null)} />
        )}
      </Sheet>
    </section>
  );
}

// ─── Writing ──────────────────────────────────────────────────────────────

function MethodText({ variationId, steps }: { variationId: Id; steps: Step[] }) {
  const [text, setText] = useState(() => steps.map((s) => s.text).join('\n'));
  const { change, flush } = useAutosave(async (value: string) => announceStatus(await saveSteps(variationId, value.split('\n'))), 800);

  return (
    <div class="field">
      <label class="visually-hidden" for="steps">
        Method
      </label>
      <textarea
        id="steps"
        class="textarea"
        rows={Math.max(3, text.split('\n').length + 1)}
        value={text}
        placeholder={'Roast bones 200°C 45 min\nCover with water, simmer 6 hrs, skim\nPass, chill'}
        onInput={(e) => {
          setText(e.currentTarget.value);
          change(e.currentTarget.value);
        }}
        onBlur={flush}
      />
      <Hint name="method" field empty={!text.trim()}>One step per line, in your own shorthand.</Hint>
    </div>
  );
}

// ─── Reading view ─────────────────────────────────────────────────────────

/**
 * The method to cook from: numbered steps, each with what's known about it
 * as quiet chips and its techniques linked. Nothing here edits; a missing
 * reading ("+ time") opens edit mode.
 */
export function MethodSteps({ variation, steps, onEdit }: { variation: Variation; steps: Step[]; onEdit: () => void }) {
  const equipmentKitchen = useLiveQuery(() => equipmentKitchenId(variation), [variation.id, variation.kitchenId]);
  const equipment = useLiveQuery(async () => (equipmentKitchen ? listEquipment(equipmentKitchen) : []), [equipmentKitchen]);
  const targets = useLiveQuery(async () => (equipmentKitchen ? getTargets(equipmentKitchen) : {}), [equipmentKitchen]);
  if (steps.length === 0) return null;
  return (
    <ol class="method-steps method-steps--reading" role="list" aria-label="Method">
      {steps.map((step, index) => (
        <li key={step.id} class="method-step">
          <p class="method-step__text">
            <span class="method-step__number">{index + 1}</span> <TechniqueText text={step.text} />
          </p>
          {step.parts.map((part, partIndex) => {
            const holdOnly = part.mode === null && part.hold !== null && part.minutesMin === null;
            const name = equipmentName(part, equipment ?? []);
            const time = part.minutesMin !== null ? formatMinuteRange(part.minutesMin, part.minutesMax) : null;
            const facts = holdOnly ? [] : [part.mode ? MODE_LABELS[part.mode].toLowerCase() : null, name ? [name, part.equipmentSetting].filter(Boolean).join(' ') : part.equipmentSetting, time];
            const cues = cueLabels(part, targets ?? {});
            // Only a missing time is worth a prompt here: it's what keeps a recipe out of the plan.
            const needsTime = !holdOnly && time === null && !part.atService;
            if (!facts.some(Boolean) && cues.length === 0 && !needsTime) return null;
            return (
              <div key={partIndex} class="method-step__part">
                {step.parts.length > 1 && <p class="method-step__part-text">{part.text}</p>}
                <div class="cluster" style={{ '--gutter': 'var(--space-3xs)' }}>
                  {facts.filter(Boolean).map((fact) => (
                    <span key={fact} class="fact-chip">
                      {fact}
                    </span>
                  ))}
                  {needsTime && (
                    <button class="fact-chip" type="button" data-empty="true" onClick={onEdit}>
                      + time
                    </button>
                  )}
                  {cues.map((cue) => (
                    <span key={cue} class="fact-chip" data-cue="true">
                      {cue}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </li>
      ))}
    </ol>
  );
}

// ─── Readings ─────────────────────────────────────────────────────────────

function equipmentName(part: StepPart, equipment: readonly ListValue[]) {
  return equipment.find((v) => v.id === part.equipmentTypeId)?.value ?? null;
}

/** The small cues a part carries, as chips: "every 60 min", "to order", "holds 3 days". */
function cueLabels(part: StepPart, targets: Partial<Record<string, string>> = {}): string[] {
  const cues: string[] = [];
  if (part.checkEveryMinutes) cues.push(`check every ${formatMinuteRange(part.checkEveryMinutes, part.checkEveryMinutes)}`);
  if (part.atService) cues.push('to order');
  if (part.relativeTime) cues.push('runs on from the step before');
  if (part.noGap) cues.push('straight after');
  if (part.previousDay) cues.push('day before');
  // Critical points with the kitchen's own target, or the legal limit as a reminder (FS3).
  const critical = part.criticalPoint ? criticalTarget(part.criticalPoint, targets[part.criticalPoint]) : null;
  if (critical) cues.push(critical.text);
  if (part.hold) {
    const days = part.hold.minutes / 1440;
    const length = Number.isInteger(days) ? `${days} ${days === 1 ? 'day' : 'days'}` : formatMinuteRange(part.hold.minutes, part.hold.minutes);
    cues.push(part.hold.where === 'warm' ? `hold warm ${length} max` : `holds ${length}`);
  }
  if (part.pauseBlocker === 'emulsion') cues.push("can't pause: emulsion");
  if (part.dependsOnComponentIds.length) cues.push(`needs ${part.dependsOnComponentIds.length === 1 ? 'a component' : `${part.dependsOnComponentIds.length} components`}`);
  return cues;
}

function StepCard(props: { step: Step; number: number; equipment: readonly ListValue[]; targets: Partial<Record<string, string>>; onOpen: (part: number) => void }) {
  const { step, number, equipment, targets, onOpen } = props;
  const several = step.parts.length > 1;
  return (
    <li class="method-step" data-confirmed={step.confirmed}>
      <p class="method-step__text">
        <span class="method-step__number">{number}</span> <TechniqueText text={step.text} />
      </p>
      {step.parts.map((part, index) => {
        const holdOnly = part.mode === null && part.hold !== null && part.minutesMin === null;
        const name = equipmentName(part, equipment);
        return (
          <div key={index} class="method-step__part">
            {several && <p class="method-step__part-text">{part.text}</p>}
            <div class="cluster" style={{ '--gutter': 'var(--space-3xs)' }}>
              {!holdOnly && (
                <>
                  <ReadingChip value={part.mode ? MODE_LABELS[part.mode] : null} empty="+ kind" onClick={() => onOpen(index)} />
                  <ReadingChip
                    value={part.minutesMin !== null ? formatMinuteRange(part.minutesMin, part.minutesMax) : null}
                    empty={part.atService ? 'at service' : '+ time'}
                    onClick={() => onOpen(index)}
                  />
                  <ReadingChip value={name ? [name, part.equipmentSetting].filter(Boolean).join(' ') : part.equipmentSetting} empty="+ equipment" onClick={() => onOpen(index)} />
                </>
              )}
              {cueLabels(part, targets).map((cue) => (
                <ReadingChip key={cue} value={cue} cue onClick={() => onOpen(index)} />
              ))}
            </div>
          </div>
        );
      })}
      <button
        class="chip method-step__confirm"
        type="button"
        aria-pressed={step.confirmed}
        onClick={() => trackSave(confirmStep(step.id, !step.confirmed)).then(announceStatus)}
      >
        {step.confirmed ? '✓ Confirmed' : 'Looks right'}
      </button>
    </li>
  );
}

function ReadingChip({ value, empty, cue, onClick }: { value: string | null; empty?: string; cue?: boolean; onClick: () => void }) {
  return (
    <button class="chip reading-chip" type="button" data-empty={value === null} data-cue={cue} onClick={onClick}>
      {value ?? empty}
    </button>
  );
}

// ─── Correcting ───────────────────────────────────────────────────────────

/**
 * Corrects one part of a step. A change to the kind of step or the
 * equipment also goes into the word list for the step's verb (P2), with
 * Undo; the time and setting are this recipe's own.
 */
function PartEditor(props: { step: Step; index: number; equipment: readonly ListValue[]; kitchenId: KitchenId | null; onPart: (index: number) => void; onDone: () => void }) {
  const { step, index, equipment, kitchenId, onPart, onDone } = props;
  const part = step.parts[index];
  const [typedTime, setTypedTime] = useState(part && part.minutesMin !== null ? formatMinuteRange(part.minutesMin, part.minutesMax) : '');
  const [setting, setSetting] = useState(part?.equipmentSetting ?? '');
  if (!part) return null;

  const save = async (changes: Partial<StepPart>) => announceStatus(await trackSave(updateStepPart(step.id, index, changes)));

  async function teach(meaning: { mode?: StepMode | null; equipmentTypeId?: Id | null }, said: string) {
    if (!part?.verb) return;
    const { before, id } = await learnWord(part.verb, meaning);
    showMessage(`From now on, “${part.verb}” reads as ${said}.`, () => unlearnWord(id, before));
  }

  const time = readTypedMinutes(typedTime);
  const flags = [
    ...(part.atService ? ['service' as const] : []),
    ...(part.noGap ? ['noGap' as const] : []),
    ...(part.previousDay ? ['previousDay' as const] : []),
  ];

  return (
    <>
      <p class="method-step__text">{part.text}</p>
      {step.parts.length > 1 && (
        <ChipChoice
          label="Part"
          choices={step.parts.map((p, i) => ({ value: i, label: `${i + 1}. ${p.verb ?? p.text.split(' ')[0] ?? ''}` }))}
          value={index}
          onChange={(i) => i !== null && onPart(i)}
        />
      )}

      <ChipChoice
        label="Kind of step"
        choices={STEP_MODES.map((mode) => ({ value: mode, label: MODE_LABELS[mode] }))}
        value={part.mode}
        onChange={async (mode) => {
          await save({ mode });
          if (mode) await teach({ mode }, MODE_LABELS[mode].toLowerCase());
        }}
      />
      {part.mode && <p class="field__hint">{MODE_HINTS[part.mode]}</p>}

      <div class="field">
        <label class="label" for="part-time">
          Time
        </label>
        <input
          class="input"
          id="part-time"
          value={typedTime}
          placeholder="45, 40-45, 1h30, 2+ (at least)"
          autocomplete="off"
          onInput={(e) => setTypedTime(e.currentTarget.value)}
          onBlur={() => {
            if (!typedTime.trim()) void save({ minutesMin: null, minutesMax: null });
            else if (time) void save({ minutesMin: time.min, minutesMax: time.max });
          }}
        />
        <p class="field__hint" aria-live="polite">
          {typedTime.trim() ? (time ? `Reads as ${formatMinuteRange(time.min, time.max)}` : 'Can’t read that as a time: try 45, 40-45 or 1h30.') : 'Minutes unless you say hours.'}
        </p>
      </div>

      <ChipChoice
        label="Equipment"
        choices={equipment.map((v) => ({ value: v.id, label: v.value }))}
        value={part.equipmentTypeId}
        allowNone
        onChange={async (equipmentTypeId) => {
          await save({ equipmentTypeId });
          const name = equipment.find((v) => v.id === equipmentTypeId)?.value;
          if (name) await teach({ equipmentTypeId }, `“${name}”`);
        }}
      />
      <p class="field__hint">Bench means by hand: a bowl and a whisk, a board and a knife. Hands-on work doesn’t need any.</p>
      <AddEquipment
        kitchenId={kitchenId}
        onAdded={async (equipmentTypeId, name) => {
          await save({ equipmentTypeId });
          await teach({ equipmentTypeId }, `“${name}”`);
        }}
      />

      {/* Settings and timing flags matter for some steps only: tucked away unless one is set. */}
      <AddTechniqueWord suggestion={part.verb ?? ''} />

      <details class="part-more" open={Boolean(part.equipmentSetting) || flags.length > 0}>
        <summary>Setting and timing</summary>
        <div class="flow">
          <div class="field">
            <label class="label" for="part-setting">
              Setting
            </label>
            <input
              class="input"
              id="part-setting"
              value={setting}
              placeholder="180°C, 160°C fan, low"
              autocomplete="off"
              onInput={(e) => setSetting(e.currentTarget.value)}
              onBlur={() => setting !== (part.equipmentSetting ?? '') && save({ equipmentSetting: setting.trim() || null })}
            />
          </div>
          <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
            <p class="label">Timing</p>
            <ChipToggles
              label="Timing"
              choices={[
                { value: 'service', label: 'Done to order' },
                { value: 'noGap', label: 'Straight after the step before' },
                { value: 'previousDay', label: 'Starts the day before' },
              ]}
              values={flags}
              onChange={(values) => save({ atService: values.includes('service'), noGap: values.includes('noGap'), previousDay: values.includes('previousDay') })}
            />
          </div>
        </div>
      </details>

      {step.confirmed ? (
        <button class="button" type="button" data-variant="primary" onClick={onDone}>
          Done
        </button>
      ) : (
        <button
          class="button"
          type="button"
          data-variant="primary"
          onClick={async () => {
            // A time typed but not yet blurred still counts.
            if (time && (time.min !== part.minutesMin || time.max !== part.minutesMax)) await save({ minutesMin: time.min, minutesMax: time.max });
            announceStatus(await trackSave(confirmStep(step.id, true)));
            onDone();
          }}
        >
          Looks right
        </button>
      )}
    </>
  );
}

/** "Something else": adds to the kitchen's equipment list and chooses it. */
function AddEquipment({ kitchenId, onAdded }: { kitchenId: KitchenId | null; onAdded: (id: Id, name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  if (!kitchenId) return null;
  async function add(event: Event) {
    event.preventDefault();
    try {
      const id = await trackSave(addListItem({ kind: 'values', list: 'equipment-types', kitchenId: kitchenId! }, name));
      await onAdded(id, name.trim());
      setName('');
      setError('');
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add it.');
    }
  }
  return (
    <form class="input-group" onSubmit={add}>
      <input
        class="input"
        aria-label="Other equipment"
        placeholder="Other: Pacojet, dehydrator…"
        autocomplete="off"
        value={name}
        onInput={(e) => setName(e.currentTarget.value)}
      />
      <button class="button" type="submit" disabled={!name.trim()}>
        Add
      </button>
      {error && <p class="field__error">{error}</p>}
    </form>
  );
}

/**
 * "A word here is a technique": adds it to your techniques, so it's linked
 * in every step from now on (Phase 7: "add an unknown technique word from
 * a step chip").
 */
function AddTechniqueWord({ suggestion }: { suggestion: string }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState(suggestion);
  if (!open) {
    return (
      <button class="button" type="button" data-variant="ghost" onClick={() => setOpen(true)}>
        A word here is a technique
      </button>
    );
  }
  return (
    <form
      class="input-group"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!word.trim()) return;
        const id = await trackSave(createTechnique(word));
        setOpen(false);
        showMessage(`“${word.trim()}” is a technique now, linked wherever it’s written.`, { view: { label: 'Open', href: paths.technique(id) } });
      }}
    >
      <input class="input" aria-label="Technique word" value={word} placeholder="dauphinoise" autocomplete="off" onInput={(e) => setWord(e.currentTarget.value)} />
      <button class="button" type="submit" disabled={!word.trim()}>
        Add
      </button>
    </form>
  );
}

// ─── What's missing ───────────────────────────────────────────────────────

/** "Draft: step 3, no time", each with one tap to fix it (SPEC → Draft or ready). */
function MissingList({ missing, onFix }: { missing: Missing[]; onFix: (item: Missing) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? missing : missing.slice(0, 4);
  return (
    <div class="card missing" aria-labelledby="missing-title">
      <div class="card__body flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
        <h3 id="missing-title">Draft: what’s missing before it can go in the plan</h3>
        <ul class="row-list" role="list">
          {shown.map((item) => (
            <li key={`${item.step}-${item.part}-${item.field}`}>
              <button class="list-row" type="button" onClick={() => onFix(item)}>
                <span class="list-row__main">
                  <span class="list-row__title">{item.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {missing.length > shown.length && (
          <button class="button" type="button" data-variant="ghost" onClick={() => setAll(true)}>
            Show all {missing.length}
          </button>
        )}
      </div>
    </div>
  );
}

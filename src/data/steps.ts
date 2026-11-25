/**
 * Method steps and the step reader (SPEC → Step language and parser, Draft
 * or ready; DECISIONS 38–40).
 *
 * The reader in src/core/parser works with words ("oven", "brown stock");
 * this file turns them into the chef's records and back:
 * - equipment names → the kitchen's 'equipment-types' list values;
 * - @references → components; ingredient words → the recipe's lines;
 * - the word list (corrections) → words the reader understands.
 *
 * Every change to a variation's steps re-works out whether it's draft or
 * ready, and says why when it drops back to draft.
 */

import { findByName, normalizeName } from '../core/ingredients/names';
import { readStep, type ChefWord, type ReadPart, type StepMode } from '../core/parser/parseStep';
import { whatsMissing, type Missing } from '../core/parser/readiness';
import { db as appDb, type MepDatabase } from './db';
import { getPlace } from './kitchens';
import type { Component, Id, KitchenId, ListValue, Step, StepPart, Variation, WordListEntry } from './types';

// ─── What the reader needs to know ────────────────────────────────────────

/** The chef's records the reader's words are matched against. */
export interface ReaderContext {
  /** The kitchen's equipment, in list order. */
  equipment: ListValue[];
  words: ChefWord[];
  components: Component[];
  /** The recipe's lines, named: for "time scales with". */
  lines: { id: Id; name: string; aliases: string[] }[];
  /** The component being read: it can't depend on itself. */
  componentId: Id | null;
}

/** Whose equipment a variation's steps use: its own kitchen's, or where the chef is today. */
export async function equipmentKitchenId(variation: Variation | undefined, database: MepDatabase = appDb): Promise<KitchenId> {
  return variation?.kitchenId ?? (await getPlace(database)).kitchenId;
}

/** The kitchen's equipment list, visible values only, in order. */
export async function listEquipment(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<ListValue[]> {
  const values = await database.listValues.where('list').equals('equipment-types').toArray();
  return values.filter((v) => v.kitchenId === kitchenId && !v.hidden && !v.mergedIntoId).sort((a, b) => a.order - b.order);
}

export async function loadReaderContext(variation: Variation | undefined, versionId: Id | null, database: MepDatabase = appDb): Promise<ReaderContext> {
  const kitchenId = await equipmentKitchenId(variation, database);
  const [equipment, allValues, entries, components] = await Promise.all([
    listEquipment(kitchenId, database),
    database.listValues.where('list').equals('equipment-types').toArray(),
    database.wordListEntries.toArray(),
    database.components.toArray(),
  ]);
  const valueNames = new Map(allValues.map((v) => [v.id, v.value]));
  const words = entries.map((e) => ({ word: e.word, mode: e.mode, equipment: e.equipmentTypeId ? (valueNames.get(e.equipmentTypeId) ?? null) : null }));

  let lines: ReaderContext['lines'] = [];
  if (versionId) {
    const rows = await database.lines.where('versionId').equals(versionId).toArray();
    const ingredients = new Map((await database.ingredients.bulkGet(rows.map((l) => l.ingredientId).filter((id) => id !== null))).filter((i) => i !== undefined).map((i) => [i.id, i]));
    lines = rows.flatMap((line) => {
      const ingredient = line.ingredientId ? ingredients.get(line.ingredientId) : undefined;
      const component = line.componentId ? components.find((c) => c.id === line.componentId) : undefined;
      const named = ingredient ?? component;
      return named ? [{ id: line.id, name: named.name, aliases: named.aliases }] : [];
    });
  }
  return { equipment, words, components, lines, componentId: variation?.componentId ?? null };
}

/** The list value for an equipment name ("water bath" → the kitchen's "Water bath"). */
export function equipmentIdFor(name: string | null, equipment: readonly ListValue[]): Id | null {
  if (!name) return null;
  const wanted = normalizeName(name);
  return equipment.find((v) => normalizeName(v.value) === wanted)?.id ?? null;
}

/** Turns the reader's parts into stored parts, matched to the chef's records. */
export function toStepParts(readParts: readonly ReadPart[], context: ReaderContext): StepPart[] {
  const others = context.components.filter((c) => c.id !== context.componentId);
  return readParts.map((part) => {
    const dependsOn = part.dependsOn.map((name) => findByName(others, name)?.id).filter((id) => id !== undefined);
    const words = normalizeName(part.text);
    // A line whose ingredient the part names: its time scales with that amount.
    const scales = context.lines.find((line) =>
      [line.name, ...line.aliases].some((n) => {
        const name = normalizeName(n);
        return name.length > 2 && (` ${words} `.includes(` ${name} `) || ` ${words} `.includes(` ${name}s `));
      }),
    );
    return {
      text: part.text,
      verb: part.verb,
      mode: part.mode,
      minutesMin: part.minutes?.min ?? null,
      minutesMax: part.minutes ? part.minutes.max : null,
      equipmentTypeId: equipmentIdFor(part.equipment, context.equipment),
      equipmentSetting: part.setting,
      checkEveryMinutes: part.checkEvery,
      dependsOnComponentIds: [...new Set(dependsOn)],
      scalesWithLineId: scales?.id ?? null,
      templateComponentId: part.templateRef ? (findByName(others, part.templateRef)?.id ?? null) : null,
      hold: part.hold,
      pausable: part.pausable,
      pauseBlocker: part.pauseBlocker,
      criticalPoint: part.critical,
      atService: part.atService,
      relativeTime: part.relativeTime,
      noGap: part.noGap,
      previousDay: part.previousDay,
    };
  });
}

/** A stored part as the reader's "step before", for reading the next line. */
function asReadPart(part: StepPart, equipment: readonly ListValue[]): ReadPart {
  return {
    text: part.text,
    verb: part.verb,
    mode: part.mode,
    minutes: part.minutesMin === null ? null : { min: part.minutesMin, max: part.minutesMax },
    equipment: equipment.find((v) => v.id === part.equipmentTypeId)?.value.toLowerCase() ?? null,
    setting: part.equipmentSetting,
    checkEvery: part.checkEveryMinutes,
    dependsOn: [],
    templateRef: null,
    hold: part.hold,
    critical: part.criticalPoint as ReadPart['critical'],
    pausable: part.pausable,
    pauseBlocker: part.pauseBlocker as ReadPart['pauseBlocker'],
    atService: part.atService,
    relativeTime: part.relativeTime,
    noGap: part.noGap,
    previousDay: part.previousDay,
  };
}

// ─── Saving the method ────────────────────────────────────────────────────

/**
 * Saves a method written one step per line. A line that hasn't changed keeps
 * its readings and its confirmation; a new or changed line is read again.
 */
export async function writeSteps(
  variation: Variation,
  versionId: Id,
  texts: string[],
  database: MepDatabase,
): Promise<void> {
  const cleaned = texts.map((t) => t.trim()).filter(Boolean);
  const context = await loadReaderContext(variation, versionId, database);
  const existing = await database.steps.where('versionId').equals(versionId).sortBy('order');
  let previous: ReadPart | null = null;

  for (const [order, text] of cleaned.entries()) {
    const stored = existing[order];
    if (stored && stored.text === text) {
      if (stored.order !== order) await database.steps.update(stored.id, { order });
      previous = stored.parts.length ? asReadPart(stored.parts.at(-1)!, context.equipment) : previous;
      continue;
    }
    const read = readStep(text, { words: context.words, previous });
    const parts = toStepParts(read, context);
    previous = read.at(-1) ?? previous;
    // Changed wording means the old readings and confirmation no longer apply.
    if (stored) await database.steps.update(stored.id, { text, order, parts, confirmed: false });
    else await database.steps.add({ versionId, order, text, parts, confirmed: false });
  }
  await database.steps.bulkDelete(existing.slice(cleaned.length).map((s) => s.id));
}

/**
 * Reads steps that have text but no readings: rows from before the reader
 * existed (schema v4 migration) and imports of old exports. Run at start-up.
 */
export async function readUnreadSteps(database: MepDatabase = appDb): Promise<number> {
  const unread = await database.steps.filter((s) => s.parts.length === 0 && s.text.trim().length > 0).toArray();
  const byVersion = new Map<Id, Step[]>();
  for (const step of unread) byVersion.set(step.versionId, [...(byVersion.get(step.versionId) ?? []), step]);
  for (const [versionId, steps] of byVersion) {
    const version = await database.versions.get(versionId);
    const variation = version ? await database.variations.get(version.variationId) : undefined;
    const context = await loadReaderContext(variation, versionId, database);
    for (const step of steps) {
      await database.steps.update(step.id, { parts: toStepParts(readStep(step.text, { words: context.words }), context) });
    }
    if (variation) await refreshStatus(variation.id, database);
  }
  return unread.length;
}

// ─── Correcting and confirming ────────────────────────────────────────────

async function variationOfStep(stepId: Id, database: MepDatabase) {
  const step = await database.steps.get(stepId);
  const version = step ? await database.versions.get(step.versionId) : undefined;
  return { step, variationId: version?.variationId ?? null };
}

/** Corrects one part's readings. Returns the status change, if any. */
export async function updateStepPart(stepId: Id, index: number, changes: Partial<StepPart>, database: MepDatabase = appDb): Promise<StatusChange | null> {
  const { step, variationId } = await variationOfStep(stepId, database);
  if (!step?.parts[index]) return null;
  const parts = step.parts.map((part, i) => (i === index ? { ...part, ...changes } : part));
  await database.steps.update(stepId, { parts });
  return variationId ? refreshStatus(variationId, database) : null;
}

/** The chef has checked a step's readings ("Looks right"), or takes that back. */
export async function confirmStep(stepId: Id, confirmed: boolean, database: MepDatabase = appDb): Promise<StatusChange | null> {
  const { variationId } = await variationOfStep(stepId, database);
  await database.steps.update(stepId, { confirmed });
  return variationId ? refreshStatus(variationId, database) : null;
}

/** Confirms every step of the variation's current method. Returns the ids it confirmed (for undo) and the status change. */
export async function confirmAllSteps(variationId: Id, database: MepDatabase = appDb): Promise<{ ids: Id[]; change: StatusChange | null }> {
  const variation = await database.variations.get(variationId);
  if (!variation?.currentVersionId) return { ids: [], change: null };
  const ids = (await database.steps.where('versionId').equals(variation.currentVersionId).toArray()).filter((s) => !s.confirmed).map((s) => s.id);
  await database.transaction('rw', database.steps, async () => {
    for (const id of ids) await database.steps.update(id, { confirmed: true });
  });
  return { ids, change: await refreshStatus(variationId, database) };
}

export async function unconfirmSteps(ids: Id[], variationId: Id, database: MepDatabase = appDb) {
  await database.transaction('rw', database.steps, async () => {
    for (const id of ids) await database.steps.update(id, { confirmed: false });
  });
  await refreshStatus(variationId, database);
}

// ─── Draft or ready ───────────────────────────────────────────────────────

export interface StatusChange {
  from: Variation['status'];
  to: Variation['status'];
  /** Why it's a draft (empty when ready). */
  missing: Missing[];
}

/** What keeps a variation's current method a draft. Empty = ready. */
export async function getMissing(variationId: Id, database: MepDatabase = appDb): Promise<Missing[]> {
  const variation = await database.variations.get(variationId);
  const steps = variation?.currentVersionId ? await database.steps.where('versionId').equals(variation.currentVersionId).sortBy('order') : [];
  return missingFor(steps);
}

function missingFor(steps: Step[]): Missing[] {
  return whatsMissing(
    steps.map((s) => ({
      text: s.text,
      confirmed: s.confirmed,
      parts: s.parts.map((p) => ({ ...p, equipment: p.equipmentTypeId })),
    })),
  );
}

/** Works out draft or ready from the steps and stores it on the variation. */
export async function refreshStatus(variationId: Id, database: MepDatabase = appDb): Promise<StatusChange | null> {
  const variation = await database.variations.get(variationId);
  if (!variation) return null;
  const missing = await getMissing(variationId, database);
  const to = missing.length === 0 ? 'ready' : 'draft';
  if (to !== variation.status) await database.variations.update(variationId, { status: to });
  return { from: variation.status, to, missing };
}

// ─── The word list ────────────────────────────────────────────────────────

export function listWords(database: MepDatabase = appDb): Promise<WordListEntry[]> {
  return database.wordListEntries.orderBy('word').toArray();
}

/** Every equipment value's name by id, across kitchens: for showing word list entries. */
export async function equipmentNames(database: MepDatabase = appDb): Promise<Map<Id, string>> {
  return new Map((await database.listValues.where('list').equals('equipment-types').toArray()).map((v) => [v.id, v.value]));
}

/**
 * Remembers what a word means (P2): the next step read with it gets this
 * mode or equipment. Returns the entry as it was before, for undo
 * (undefined = there wasn't one).
 */
export async function learnWord(
  word: string,
  meaning: { mode?: StepMode | null; equipmentTypeId?: Id | null },
  database: MepDatabase = appDb,
): Promise<{ before: WordListEntry | undefined; id: Id }> {
  const key = normalizeName(word);
  const before = await database.wordListEntries.where('word').equals(key).first();
  if (before) {
    await database.wordListEntries.update(before.id, meaning);
    return { before, id: before.id };
  }
  const id = await database.wordListEntries.add({ word: key, mode: meaning.mode ?? null, equipmentTypeId: meaning.equipmentTypeId ?? null });
  return { before: undefined, id };
}

/** Puts a word back as it was before learnWord. */
export async function unlearnWord(id: Id, before: WordListEntry | undefined, database: MepDatabase = appDb) {
  if (before) await database.wordListEntries.put(before);
  else await database.wordListEntries.delete(id);
}

export async function deleteWord(id: Id, database: MepDatabase = appDb): Promise<WordListEntry | undefined> {
  const entry = await database.wordListEntries.get(id);
  await database.wordListEntries.delete(id);
  return entry;
}

export async function restoreWord(entry: WordListEntry, database: MepDatabase = appDb) {
  await database.wordListEntries.put(entry);
}

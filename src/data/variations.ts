/**
 * Variations: several ways of making one component (SPEC → Variations and
 * versions; V1, V4, V5; DECISIONS 18, 46).
 *
 * Which variation is *in use* is worked out, never chosen: this kitchen's
 * house recipe, then the chef's own, then any other (library.ts →
 * getVariationInUse). The chips under a component's name only choose which
 * one is *shown*.
 */

import { formatAmount } from '../core/scaling/rounding';
import { db as appDb, type MepDatabase } from './db';
import { getVariationInUse } from './library';
import { ListError } from './lists';
import type { Snapshot } from './snapshot';
import type { CalendarDate, Id, KitchenId, Variation, VariationSource } from './types';

export interface VariationLabel {
  variation: Variation;
  /** "House · Dumbleton Hall", "Mine", "Leiths", "Idea". */
  label: string;
  inUse: boolean;
}

const SOURCE_ORDER: Record<VariationSource, number> = { house: 0, mine: 1, book: 2, idea: 3 };

/** A component's variations: the one in use first, then house, mine, books, ideas. */
export async function listVariations(componentId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<VariationLabel[]> {
  const variations = await database.variations.where('componentId').equals(componentId).toArray();
  const inUse = await getVariationInUse(componentId, kitchenId, database);
  const kitchens = new Map((await database.kitchens.toArray()).map((k) => [k.id, k.name]));
  return variations
    .map((variation) => ({ variation, label: labelFor(variation, kitchens), inUse: variation.id === inUse?.id }))
    .sort(
      (a, b) =>
        Number(b.inUse) - Number(a.inUse) ||
        SOURCE_ORDER[a.variation.source] - SOURCE_ORDER[b.variation.source] ||
        a.variation.createdAt.localeCompare(b.variation.createdAt),
    );
}

function labelFor(variation: Variation, kitchens: Map<Id, string>): string {
  if (variation.source === 'house') return `House · ${kitchens.get(variation.kitchenId ?? '') ?? 'a kitchen'}`;
  if (variation.source === 'mine') return variation.sourceDetail ? `Mine · ${variation.sourceDetail}` : 'Mine';
  if (variation.source === 'book') return variation.sourceDetail ?? 'Book or chef';
  return variation.sourceDetail ? `Idea · ${variation.sourceDetail}` : 'Idea';
}

/**
 * A copy of a variation as the chef's own (V1: "fork the house variation
 * into my own"), starting from its current version. Returns the new id.
 */
export async function forkVariation(variationId: Id, database: MepDatabase = appDb): Promise<Id> {
  return database.transaction('rw', [database.variations, database.versions, database.lines, database.steps], async () => {
    const from = await database.variations.get(variationId);
    if (!from) throw new Error('That variation no longer exists.');
    const id = await database.variations.add({
      componentId: from.componentId,
      source: 'mine',
      sourceDetail: null,
      kitchenId: null,
      forkedFromId: from.id,
      status: 'draft',
      baseYield: from.baseYield,
      note: '',
      suggestedToChef: null,
      currentVersionId: null,
    });
    const versionId = await database.versions.add({ variationId: id, parentId: null, changeNote: 'Copied as my own' });
    await database.variations.update(id, { currentVersionId: versionId });
    if (from.currentVersionId) {
      const lineIds = new Map<Id, Id>();
      for (const { id: oldId, createdAt: _c, updatedAt: _u, ...line } of await database.lines.where('versionId').equals(from.currentVersionId).toArray()) {
        lineIds.set(oldId, await database.lines.add({ ...line, versionId }));
      }
      for (const { id: _id, createdAt: _c, updatedAt: _u, ...step } of await database.steps.where('versionId').equals(from.currentVersionId).toArray()) {
        await database.steps.add({
          ...step,
          versionId,
          // Its readings carry over, but the chef confirms their own copy.
          confirmed: false,
          parts: step.parts.map((p) => ({ ...p, scalesWithLineId: p.scalesWithLineId ? (lineIds.get(p.scalesWithLineId) ?? null) : null })),
        });
      }
    }
    return id;
  });
}

/** An empty variation: from a book or another chef, or an idea (V5). Returns its id. */
export async function createVariation(
  componentId: Id,
  origin: { source: 'book' | 'idea' | 'mine'; sourceDetail: string | null; note?: string },
  database: MepDatabase = appDb,
): Promise<Id> {
  return database.transaction('rw', database.variations, database.versions, async () => {
    const id = await database.variations.add({
      componentId,
      source: origin.source,
      sourceDetail: origin.sourceDetail?.trim() || null,
      kitchenId: null,
      forkedFromId: null,
      status: 'draft',
      baseYield: null,
      note: origin.note ?? '',
      suggestedToChef: null,
      currentVersionId: null,
    });
    const versionId = await database.versions.add({ variationId: id, parentId: null, changeNote: null });
    await database.variations.update(id, { currentVersionId: versionId });
    return id;
  });
}

/** The note on a variation: for an idea, the idea itself ("brown the butter first"). */
export async function setVariationNote(variationId: Id, note: string, database: MepDatabase = appDb) {
  await database.variations.update(variationId, { note });
}

/** Marks an idea as suggested to chef on a date, with their response (V5); null clears it. */
export async function setSuggestedToChef(
  variationId: Id,
  suggested: { on: CalendarDate; response: string | null } | null,
  database: MepDatabase = appDb,
) {
  await database.variations.update(variationId, { suggestedToChef: suggested });
}

/** Deletes one variation with its versions. Refused for a component's only variation. Returns a snapshot for Undo. */
export async function deleteVariation(variationId: Id, database: MepDatabase = appDb): Promise<Snapshot> {
  return database.transaction('rw', [database.variations, database.versions, database.lines, database.steps, database.notes], async () => {
    const variation = await database.variations.get(variationId);
    if (!variation) return {};
    const siblings = await database.variations.where('componentId').equals(variation.componentId).count();
    if (siblings <= 1) throw new ListError('It’s the only way of making this component. Delete the component instead.');
    const versions = await database.versions.where('variationId').equals(variationId).toArray();
    const versionIds = versions.map((v) => v.id);
    const lines = await database.lines.where('versionId').anyOf(versionIds).toArray();
    const steps = await database.steps.where('versionId').anyOf(versionIds).toArray();
    // Attempt notes stay with the component; they just stop pointing at this variation.
    const notes = await database.notes.filter((n) => n.links.some((l) => l.kind === 'variation' && l.id === variationId)).toArray();
    await database.variations.delete(variationId);
    await database.versions.bulkDelete(versionIds);
    await database.lines.bulkDelete(lines.map((l) => l.id));
    await database.steps.bulkDelete(steps.map((s) => s.id));
    for (const note of notes) {
      await database.notes.update(note.id, { links: note.links.filter((l) => !(l.kind === 'variation' && l.id === variationId)) });
    }
    return { variations: [variation], versions, lines, steps, notes };
  });
}

// ─── Attempt notes (V2) ───────────────────────────────────────────────────

/** A dated note on an attempt: "too much acid, cut vinegar 10%". Returns its id. */
export async function addAttempt(componentId: Id, variationId: Id, body: string, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Id> {
  return database.notes.add({
    kind: 'attempt',
    body: body.trim(),
    mediaIds: [],
    kitchenId,
    sectionId: null,
    links: [
      { kind: 'component', id: componentId },
      { kind: 'variation', id: variationId },
    ],
  });
}

// ─── Comparing (V4) ───────────────────────────────────────────────────────

export interface CompareRow {
  name: string;
  a: string | null;
  b: string | null;
  differs: boolean;
}

/** Two variations side by side: ingredients lined up by name, then each method. */
export async function compareVariations(aId: Id, bId: Id, database: MepDatabase = appDb) {
  const [a, b] = await Promise.all([database.variations.get(aId), database.variations.get(bId)]);
  if (!a || !b) return undefined;
  const names = new Map([...(await database.ingredients.toArray()), ...(await database.components.toArray())].map((r) => [r.id, r.name]));
  const read = async (variation: Variation) => {
    const versionId = variation.currentVersionId;
    const lines = versionId ? await database.lines.where('versionId').equals(versionId).sortBy('order') : [];
    const steps = versionId ? await database.steps.where('versionId').equals(versionId).sortBy('order') : [];
    return {
      lines: lines.map((l) => ({
        key: l.ingredientId ?? l.componentId ?? l.id,
        name: names.get(l.ingredientId ?? l.componentId ?? '') ?? '?',
        amount: [l.quantity !== null ? formatAmount(l.quantity, l.unit ?? 'each') : '✓', l.prepNote].filter(Boolean).join(', '),
      })),
      steps: steps.map((s) => s.text),
    };
  };
  const [left, right] = await Promise.all([read(a), read(b)]);
  const rows: CompareRow[] = [];
  const seen = new Set<string>();
  for (const line of [...left.lines, ...right.lines]) {
    if (seen.has(line.key)) continue;
    seen.add(line.key);
    const x = left.lines.find((l) => l.key === line.key)?.amount ?? null;
    const y = right.lines.find((l) => l.key === line.key)?.amount ?? null;
    rows.push({ name: line.name, a: x, b: y, differs: x !== y });
  }
  return { a, b, rows, stepsA: left.steps, stepsB: right.steps };
}

/**
 * House rules and batches (SPEC → Food safety; FS2, FS3; DECISIONS 52).
 *
 * - Shelf life is the kitchen's own rule, for a component or a component
 *   type ("Sauces and emulsions: 3 days"); the app never invents one.
 * - Targets for critical points (cooling, hot holding, reheating) are the
 *   kitchen's too; where there's none, steps show the legal limit as a
 *   reminder (core/foodSafety).
 * - "Made" creates a batch and shows a day-dot label: item, made, use-by,
 *   initials (and its allergens).
 * The app records what the chef enters; it doesn't replace the kitchen's
 * food safety records.
 */

import { readShelfLife, useByFrom, type CriticalKind } from '../core/foodSafety/foodSafety';
import { db as appDb, type MepDatabase } from './db';
import { componentAllergens, type Allergens } from './allergens';
import { getSetting, setSetting } from './settings';
import type { Batch, HouseRule, Id, KitchenId } from './types';

// ─── House rules ──────────────────────────────────────────────────────────

export function listHouseRules(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<HouseRule[]> {
  return database.houseRules.where('kitchenId').equals(kitchenId).toArray();
}

/** Sets (or, with empty text, removes) a shelf life for a component or a component type. */
export async function setShelfLife(
  kitchenId: KitchenId,
  appliesTo: { componentId: Id } | { componentTypeId: Id },
  value: string,
  database: MepDatabase = appDb,
) {
  const componentId = 'componentId' in appliesTo ? appliesTo.componentId : null;
  const componentTypeId = 'componentTypeId' in appliesTo ? appliesTo.componentTypeId : null;
  const existing = (await listHouseRules(kitchenId, database)).find(
    (r) => r.kind === 'shelf-life' && r.componentId === componentId && r.componentTypeId === componentTypeId,
  );
  if (!value.trim()) {
    if (existing) await database.houseRules.delete(existing.id);
  } else if (existing) await database.houseRules.update(existing.id, { value: value.trim() });
  else await database.houseRules.add({ kitchenId, kind: 'shelf-life', componentId, componentTypeId, value: value.trim() });
}

/** Sets (or removes) the kitchen's target for a critical point: "below 5°C within 90 min". */
export async function setTarget(kitchenId: KitchenId, kind: CriticalKind, value: string, database: MepDatabase = appDb) {
  const existing = (await listHouseRules(kitchenId, database)).find((r) => r.kind === kind);
  if (!value.trim()) {
    if (existing) await database.houseRules.delete(existing.id);
  } else if (existing) await database.houseRules.update(existing.id, { value: value.trim() });
  else await database.houseRules.add({ kitchenId, kind, componentId: null, componentTypeId: null, value: value.trim() });
}

/** The kitchen's targets by kind. */
export async function getTargets(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Partial<Record<CriticalKind, string>>> {
  const rules = await listHouseRules(kitchenId, database);
  return Object.fromEntries(rules.filter((r) => r.kind === 'cooling' || r.kind === 'hot-hold' || r.kind === 'reheat').map((r) => [r.kind, r.value]));
}

export interface ShelfLife {
  /** As the kitchen wrote it: "3 days". */
  text: string;
  /** null when it can't be read as a length of time. */
  minutes: number | null;
  /** Set for this component, or for its type. */
  from: 'component' | 'type';
}

/** A component's shelf life in a kitchen: its own rule first, then its type's. */
export async function shelfLifeFor(componentId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<ShelfLife | null> {
  const [component, rules] = await Promise.all([database.components.get(componentId), listHouseRules(kitchenId, database)]);
  const shelf = rules.filter((r) => r.kind === 'shelf-life');
  const own = shelf.find((r) => r.componentId === componentId);
  const byType = component?.typeId ? shelf.find((r) => r.componentTypeId === component.typeId) : undefined;
  const rule = own ?? byType;
  if (!rule) return null;
  return { text: rule.value, minutes: readShelfLife(rule.value), from: own ? 'component' : 'type' };
}

// ─── Batches and labels (FS2) ─────────────────────────────────────────────

const INITIALS = 'label.initials';

export async function getInitials(database: MepDatabase = appDb): Promise<string> {
  return (await getSetting<string>(INITIALS, database)) ?? '';
}

export async function setInitials(initials: string, database: MepDatabase = appDb) {
  await setSetting(INITIALS, initials.trim().toUpperCase().slice(0, 4), database);
}

/** "Made": records a batch, with its use-by from the kitchen's shelf life (if there's one). Returns its id. */
export async function makeBatch(componentId: Id, kitchenId: KitchenId, now = new Date(), database: MepDatabase = appDb): Promise<Id> {
  const shelf = await shelfLifeFor(componentId, kitchenId, database);
  const useBy = shelf?.minutes ? useByFrom(now, shelf.minutes).toISOString() : null;
  return database.batches.add({ componentId, kitchenId, madeAt: now.toISOString(), useBy });
}

export async function deleteBatch(id: Id, database: MepDatabase = appDb): Promise<Batch | undefined> {
  const batch = await database.batches.get(id);
  await database.batches.delete(id);
  return batch;
}

export interface BatchLabel {
  batch: Batch;
  name: string;
  initials: string;
  /** How the use-by was worked out: "3 days (sauces)"; null when the kitchen has no rule. */
  shelfLife: ShelfLife | null;
  allergens: Allergens;
}

/** Everything a day-dot label shows. */
export async function getBatchLabel(batchId: Id, database: MepDatabase = appDb): Promise<BatchLabel | undefined> {
  const batch = await database.batches.get(batchId);
  if (!batch) return undefined;
  const component = await database.components.get(batch.componentId);
  return {
    batch,
    name: component?.name ?? 'Batch',
    initials: await getInitials(database),
    shelfLife: await shelfLifeFor(batch.componentId, batch.kitchenId, database),
    allergens: await componentAllergens(batch.componentId, batch.kitchenId, null, database),
  };
}

/** A kitchen's batches, newest first (the last 50). */
export async function listBatches(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<{ batch: Batch; name: string }[]> {
  const batches = (await database.batches.where('kitchenId').equals(kitchenId).toArray()).sort((a, b) => b.madeAt.localeCompare(a.madeAt)).slice(0, 50);
  const components = await database.components.bulkGet(batches.map((b) => b.componentId));
  return batches.map((batch, i) => ({ batch, name: components[i]?.name ?? 'Batch' }));
}

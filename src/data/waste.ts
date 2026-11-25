/**
 * The waste log (A4): logged from day one; costed from Phase 11. What was
 * wasted is matched by name to a component or ingredient, so its cost can be
 * worked out from prices (never stored: a price change shows at once).
 */

import { findByName } from '../core/ingredients/names';
import { cleanName } from '../core/lists/lists';
import { toCalendarDate } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { getPlace } from './kitchens';
import { ListError } from './lists';
import type { Id, Quantity, WasteEntry } from './types';

export interface WasteInput {
  text: string;
  quantity: Quantity | null;
  reasonId: Id | null;
}

/** What a typed name means: a component, else an ingredient, else neither. */
async function matchWhat(text: string, database: MepDatabase): Promise<{ componentId: Id | null; ingredientId: Id | null }> {
  const component = findByName(await database.components.toArray(), text);
  if (component) return { componentId: component.id, ingredientId: null };
  const ingredient = findByName(await database.ingredients.toArray(), text);
  return { componentId: null, ingredientId: ingredient?.id ?? null };
}

/** Logs waste where the chef is now, dated today. */
export async function logWaste(input: WasteInput, now = new Date(), database: MepDatabase = appDb): Promise<Id> {
  const text = cleanName(input.text);
  if (!text) throw new ListError('Say what was wasted.');
  const { kitchenId } = await getPlace(database);
  const sectionId = null; // not asked any more (DECISIONS 48)
  return database.wasteEntries.add({
    kitchenId,
    sectionId,
    ...(await matchWhat(text, database)),
    text,
    quantity: input.quantity,
    reasonId: input.reasonId,
    cost: null,
    date: toCalendarDate(now),
  });
}

/** Corrects an entry: what, how much, why. Where and when stay as logged. */
export async function updateWaste(id: Id, input: WasteInput, database: MepDatabase = appDb) {
  const text = cleanName(input.text);
  if (!text) throw new ListError('Say what was wasted.');
  await database.wasteEntries.update(id, { text, quantity: input.quantity, reasonId: input.reasonId, ...(await matchWhat(text, database)) });
}

export function getWaste(id: Id, database: MepDatabase = appDb) {
  return database.wasteEntries.get(id);
}

/** Every waste entry, newest first. */
export async function listWaste(database: MepDatabase = appDb): Promise<WasteEntry[]> {
  const entries = await database.wasteEntries.toArray();
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteWaste(id: Id, database: MepDatabase = appDb): Promise<WasteEntry | undefined> {
  const entry = await database.wasteEntries.get(id);
  await database.wasteEntries.delete(id);
  return entry;
}

export async function restoreWaste(entry: WasteEntry, database: MepDatabase = appDb) {
  await database.wasteEntries.put(entry);
}

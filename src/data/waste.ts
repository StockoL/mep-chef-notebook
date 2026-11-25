/** The waste log (A4): logged from capture from day one; costs come in Phase 11. */

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

/** Logs waste where the chef is now, dated today. */
export async function logWaste(input: WasteInput, now = new Date(), database: MepDatabase = appDb): Promise<Id> {
  const text = cleanName(input.text);
  if (!text) throw new ListError('Say what was wasted.');
  const { kitchenId } = await getPlace(database);
  const sectionId = null; // not asked any more (DECISIONS 48)
  return database.wasteEntries.add({
    kitchenId,
    sectionId,
    componentId: null,
    ingredientId: null,
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
  await database.wasteEntries.update(id, { text, quantity: input.quantity, reasonId: input.reasonId });
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

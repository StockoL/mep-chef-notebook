/**
 * A dish at work (MS2): one tap to put its components on today's sheet.
 * Its allergens are in allergens.ts.
 */

import { toCalendarDate } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { getPlace } from './kitchens';
import { getDishNeeds } from './scaling';
import { addSheetItems, getOrCreateSheet } from './sheets';
import type { Id } from './types';

/**
 * Puts each of a dish's components on today's sheet (MS2, one tap). With a
 * number of portions, each goes on with the amount needed for them.
 * Returns how many items went on.
 */
export async function addDishToSheet(dishId: Id, portions: number | null, database: MepDatabase = appDb): Promise<{ sheetId: Id; added: number }> {
  const place = await getPlace(database);
  const sheetId = await getOrCreateSheet(place.kitchenId, toCalendarDate(new Date()), [], database);
  const needs = await getDishNeeds(dishId, place.kitchenId, portions ?? 1, database);
  const ids = await addSheetItems(
    sheetId,
    needs.map((need) => ({
      componentId: need.component.id,
      quantity: portions && need.amount !== null && need.unit ? { amount: need.amount, unit: need.unit } : null,
      source: 'dish' as const,
    })),
    database,
  );
  return { sheetId, added: ids.length };
}

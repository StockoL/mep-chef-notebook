/**
 * A dish at work (MS2): the allergens gathered from all its components, and
 * one tap to put its components on today's sheet. Food safety (Phase 10)
 * adds the full allergen matrix with sub-types and product checks; this is
 * what the recorded ingredients say.
 */

import { ALLERGENS, type AllergenId } from '../core/allergens/allergens';
import { toCalendarDate } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { getPlace, placeSectionIds } from './kitchens';
import { getDishDetails, getVariationInUse } from './library';
import { getDishNeeds } from './scaling';
import { addSheetItems, getOrCreateSheet } from './sheets';
import type { Id, KitchenId } from './types';

export interface GatheredAllergens {
  /** In the order of the legal list. */
  contains: { id: AllergenId; label: string }[];
  /** Bought-in ingredients: their allergens come from the product, not recorded yet. */
  unconfirmed: string[];
}

/** Allergens from every component of a dish, and the components they use, through the variation in use. */
export async function gatherDishAllergens(dishId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<GatheredAllergens> {
  const details = await getDishDetails(dishId, database);
  const found = new Set<AllergenId>();
  const unconfirmed = new Set<string>();
  const visited = new Set<Id>();

  async function walk(componentId: Id) {
    if (visited.has(componentId)) return;
    visited.add(componentId);
    const variation = await getVariationInUse(componentId, kitchenId, database);
    if (!variation?.currentVersionId) return;
    for (const line of await database.lines.where('versionId').equals(variation.currentVersionId).toArray()) {
      if (line.componentId) await walk(line.componentId);
      if (!line.ingredientId) continue;
      const ingredient = await database.ingredients.get(line.ingredientId);
      if (!ingredient) continue;
      if (ingredient.kind === 'bought-in') unconfirmed.add(ingredient.name);
      else ingredient.allergens.forEach((a) => found.add(a));
    }
  }
  for (const { component } of details?.components ?? []) await walk(component.id);

  return {
    contains: ALLERGENS.filter((a) => found.has(a.id)).map((a) => ({ id: a.id, label: a.label })),
    unconfirmed: [...unconfirmed].sort(),
  };
}

/**
 * Puts each of a dish's components on today's sheet (MS2, one tap). With a
 * number of portions, each goes on with the amount needed for them.
 * Returns how many items went on.
 */
export async function addDishToSheet(dishId: Id, portions: number | null, database: MepDatabase = appDb): Promise<{ sheetId: Id; added: number }> {
  const place = await getPlace(database);
  const sheetId = await getOrCreateSheet(place.kitchenId, toCalendarDate(new Date()), placeSectionIds(place), database);
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

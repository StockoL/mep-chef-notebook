/**
 * "Also used elsewhere" (SPEC → Section admin; A9; DECISIONS 53).
 *
 * When the chef is about to make something, a quiet line says where else
 * it, or what goes in it, is used on the menus on now ("Chalk stream trout is
 * also on Breakfast: eggs royale"). At most a prompt to tell someone: a
 * heads-up on the next sheet, or a reminder in the inbox. Their call. No
 * guesses about other sections' stock.
 */

import { toCalendarDate } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { getVariationInUse } from './library';
import { createTextNote } from './notes';
import { addSheetItems, getOrCreateSheet } from './sheets';
import type { Id, KitchenId } from './types';

export interface AlsoUsed {
  /** The shared thing: the component itself, or an ingredient in it. */
  name: string;
  /** "Breakfast: eggs royale". */
  uses: string[];
}

/** What a component's recipe uses, directly: ingredient ids. */
async function ingredientsOf(componentId: Id, kitchenId: KitchenId, database: MepDatabase): Promise<Id[]> {
  const variation = await getVariationInUse(componentId, kitchenId, database);
  if (!variation?.currentVersionId) return [];
  const lines = await database.lines.where('versionId').equals(variation.currentVersionId).toArray();
  return lines.map((l) => l.ingredientId).filter((id): id is Id => id !== null);
}

/**
 * Where else a component, or an ingredient in it, is used on this kitchen's
 * menus on now, leaving out the dishes it's made for.
 */
export async function alsoUsedElsewhere(componentId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<AlsoUsed[]> {
  const menus = (await database.menus.where('kitchenId').equals(kitchenId).toArray()).filter((m) => m.status === 'on-now');
  const mine = new Set(await ingredientsOf(componentId, kitchenId, database));
  const found = new Map<string, Set<string>>();
  const note = (name: string, where: string) => found.set(name, (found.get(name) ?? new Set()).add(where));
  const ingredientNames = new Map((await database.ingredients.toArray()).map((i) => [i.id, i.name]));
  const self = await database.components.get(componentId);

  for (const menu of menus) {
    for (const place of await database.menuDishes.where('menuId').equals(menu.id).toArray()) {
      const dish = await database.dishes.get(place.dishId);
      if (!dish) continue;
      const links = await database.dishComponents.where('dishId').equals(dish.id).toArray();
      const where = `${menu.name}: ${dish.name.toLowerCase()}`;
      if (links.some((l) => l.componentId === componentId)) {
        // The same component on another menu's dish is worth knowing about too.
        if (self) note(self.name, where);
        continue;
      }
      for (const link of links) {
        for (const ingredientId of await ingredientsOf(link.componentId, kitchenId, database)) {
          if (mine.has(ingredientId)) note(ingredientNames.get(ingredientId) ?? 'An ingredient', where);
        }
      }
    }
  }
  // The component itself only counts when it's on more than one dish.
  return [...found.entries()]
    .filter(([name, uses]) => name !== self?.name || uses.size > 1)
    .map(([name, uses]) => ({ name, uses: [...uses].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** "Heads-up" on the next shift's sheet: a plain item for whoever reads it. */
export async function addHeadsUp(kitchenId: KitchenId, text: string, now = new Date(), database: MepDatabase = appDb): Promise<Id> {
  const tomorrow = toCalendarDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const sheetId = await getOrCreateSheet(kitchenId, tomorrow, [], database);
  const [id] = await addSheetItems(sheetId, [{ text: `Heads-up: ${text}`, source: 'manual' }], database);
  return id!;
}

/** A reminder to tell someone, in the inbox. */
export function remindMe(text: string, database: MepDatabase = appDb): Promise<Id> {
  return createTextNote(`Tell someone: ${text}`, database);
}

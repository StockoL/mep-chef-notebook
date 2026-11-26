/**
 * Where dishes and recipes are from (DECISIONS 54).
 *
 * - A dish has a kitchen (schema v8): the kitchen it was written in, or null
 *   for the chef's own. Older dishes take theirs from their menus, else from
 *   their components' house recipes (inferDishKitchens).
 * - A component is from wherever its variations are: each house recipe's
 *   kitchen, and "mine" for the chef's own, books and ideas.
 * - The library filters by these, and shows them under names, so names can
 *   stay as the menu writes them. tidySuffixedNames takes "(Dumbleton, 2026)"
 *   off names written before that, once, with undo.
 *
 * Working out an older dish's kitchen is in dishKitchens.ts (pure, so the
 * database upgrade can use it).
 */

import { matchKitchen, splitOriginSuffix } from '../core/names/origin';
import { db as appDb, type MepDatabase } from './db';
import { inferDishKitchens } from './dishKitchens';
import { setVariationOrigin } from './library';
import type { Snapshot } from './snapshot';
import { NO_KITCHEN_ID, type Id, type KitchenId } from './types';

/** "Mine": not tied to a kitchen (the chef's own, a book, an idea). */
export const MINE = 'mine';
export type Origin = KitchenId | typeof MINE;

const realKitchen = (kitchenId: KitchenId | null | undefined): KitchenId | null => (kitchenId && kitchenId !== NO_KITCHEN_ID ? kitchenId : null);

/** Fills in the kitchen of dishes that came without one (an export from before v8). */
export async function fillMissingDishKitchens(database: MepDatabase = appDb): Promise<void> {
  const d = database;
  const missing = (await d.dishes.toArray()).filter((dish) => dish.kitchenId === undefined);
  if (missing.length === 0) return;
  const kitchens = inferDishKitchens({
    dishes: missing,
    menus: await d.menus.toArray(),
    menuDishes: await d.menuDishes.toArray(),
    dishComponents: await d.dishComponents.toArray(),
    variations: await d.variations.toArray(),
  });
  for (const dish of missing) await d.dishes.update(dish.id, { kitchenId: kitchens.get(dish.id) ?? null });
}

/** Says where a dish is from: a kitchen, or null for the chef's own. */
export async function setDishKitchen(dishId: Id, kitchenId: KitchenId | null, database: MepDatabase = appDb): Promise<void> {
  await database.dishes.update(dishId, { kitchenId: realKitchen(kitchenId) });
}

// ─── Origins for the library ──────────────────────────────────────────────

/** Where each component is from: its house recipes' kitchens, and "mine" for anything else. */
export async function componentOrigins(database: MepDatabase = appDb): Promise<Map<Id, Set<Origin>>> {
  const d = database;
  const out = new Map<Id, Set<Origin>>();
  for (const v of await d.variations.toArray()) {
    const set = out.get(v.componentId) ?? new Set<Origin>();
    set.add(v.source === 'house' ? (realKitchen(v.kitchenId) ?? MINE) : MINE);
    out.set(v.componentId, set);
  }
  return out;
}

export interface OriginChoice {
  value: Origin;
  label: string;
}

/** The library's "where from" chips: kitchens with something in the book (the current one first), then "Mine". */
export async function originChoices(currentKitchenId: KitchenId, database: MepDatabase = appDb): Promise<OriginChoice[]> {
  const d = database;
  const used = new Set<Origin>();
  for (const dish of await d.dishes.toArray()) used.add(realKitchen(dish.kitchenId) ?? MINE);
  for (const set of (await componentOrigins(d)).values()) for (const o of set) used.add(o);
  const kitchens = (await d.kitchens.toArray()).filter((k) => used.has(k.id));
  kitchens.sort((a, b) => Number(b.id === currentKitchenId) - Number(a.id === currentKitchenId) || Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
  const choices: OriginChoice[] = kitchens.map((k) => ({ value: k.id, label: k.name }));
  if (used.has(MINE)) choices.push({ value: MINE, label: 'Mine' });
  return choices;
}

// ─── Tidying "(Dumbleton, 2026)" off names ────────────────────────────────

export interface SuffixedName {
  kind: 'dish' | 'component';
  id: Id;
  name: string;
  /** The name without the brackets. */
  tidied: string;
  kitchenId: KitchenId;
  kitchenName: string;
}

/** Names that end with a kitchen in brackets, where the kitchen is one Mep knows. */
export async function findSuffixedNames(database: MepDatabase = appDb): Promise<SuffixedName[]> {
  const d = database;
  const kitchens = (await d.kitchens.toArray()).filter((k) => !k.builtIn);
  const out: SuffixedName[] = [];
  const check = (kind: SuffixedName['kind'], id: Id, name: string) => {
    const split = splitOriginSuffix(name);
    const kitchen = split ? matchKitchen(split.place, kitchens) : null;
    if (split && kitchen) out.push({ kind, id, name, tidied: split.name, kitchenId: kitchen.id, kitchenName: kitchen.name });
  };
  for (const dish of await d.dishes.toArray()) check('dish', dish.id, dish.name);
  for (const component of await d.components.toArray()) check('component', component.id, component.name);
  return out;
}

/**
 * Takes the brackets off and records the kitchen instead: on a dish, its
 * kitchen; on a component with one way of making it, that recipe becomes
 * the kitchen's house recipe (a component with several keeps its
 * variations as they are). Returns what Undo needs.
 */
export async function tidySuffixedNames(database: MepDatabase = appDb): Promise<{ count: number; snapshot: Snapshot }> {
  const d = database;
  const found = await findSuffixedNames(d);
  const snapshot: Required<Pick<Snapshot, 'dishes' | 'components' | 'variations' | 'steps'>> = { dishes: [], components: [], variations: [], steps: [] };
  for (const item of found) {
    if (item.kind === 'dish') {
      const dish = await d.dishes.get(item.id);
      if (!dish) continue;
      snapshot.dishes.push(dish);
      await d.dishes.update(item.id, { name: item.tidied, kitchenId: item.kitchenId });
      continue;
    }
    const component = await d.components.get(item.id);
    if (!component) continue;
    snapshot.components.push(component);
    await d.components.update(item.id, { name: item.tidied });
    const variations = await d.variations.where('componentId').equals(item.id).toArray();
    const only = variations.length === 1 ? variations[0]! : null;
    if (only && !(only.source === 'house' && only.kitchenId === item.kitchenId)) {
      snapshot.variations.push(only);
      if (only.currentVersionId) snapshot.steps.push(...(await d.steps.where('versionId').equals(only.currentVersionId).toArray()));
      await setVariationOrigin(only.id, { source: 'house', kitchenId: item.kitchenId }, d);
    }
  }
  return { count: found.length, snapshot };
}

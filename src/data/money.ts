/**
 * The Money screen (DECISIONS 54): every cost, price and GP figure in one
 * place, so recipe, dish and menu pages stay about cooking. Built from the
 * same working-out as the weekly report (costing.ts, report.ts); nothing is
 * stored.
 */

import { componentCost, type ComponentCost, type MenuDishGp } from './costing';
import { db as appDb, type MepDatabase } from './db';
import { getVariationInUse } from './library';
import { productForLine } from './products';
import { weeklyReport, type WeeklyReport } from './report';
import type { Id, KitchenId, Menu } from './types';

export interface RecipeCost {
  componentId: Id;
  name: string;
  cost: ComponentCost;
}

export interface UnpricedIngredient {
  ingredientId: Id;
  name: string;
  /** Recipes on the menus that use it: "Beurre blanc, Tartare". */
  usedIn: string[];
}

export interface MoneyView {
  /** GP for each menu on now, its dishes in menu order. */
  menus: { menu: Pick<Menu, 'id' | 'name'>; dishes: MenuDishGp[] }[];
  /** Ingredients in the menus' recipes with no price yet: what stops the GP being complete. */
  unpriced: UnpricedIngredient[];
  /** What each recipe on the menus costs, A–Z. */
  recipes: RecipeCost[];
  /** This week's stock value and waste (the weekly report's figures). */
  week: Pick<WeeklyReport, 'stock' | 'waste' | 'start' | 'end'>;
}

/** Every component the menus on now use, through the components they use. */
async function menuComponents(kitchenId: KitchenId, database: MepDatabase): Promise<Id[]> {
  const menus = (await database.menus.where('kitchenId').equals(kitchenId).toArray()).filter((m) => m.status === 'on-now');
  const dishIds = new Set((await database.menuDishes.where('menuId').anyOf(menus.map((m) => m.id)).toArray()).map((p) => p.dishId));
  const queue = (await database.dishComponents.where('dishId').anyOf([...dishIds]).toArray()).map((l) => l.componentId);
  const seen = new Set<Id>();
  while (queue.length) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const variation = await getVariationInUse(id, kitchenId, database);
    if (!variation?.currentVersionId) continue;
    for (const line of await database.lines.where('versionId').equals(variation.currentVersionId).toArray()) {
      if (line.componentId) queue.push(line.componentId);
    }
  }
  return [...seen];
}

export async function getMoneyView(kitchenId: KitchenId, now = new Date(), database: MepDatabase = appDb): Promise<MoneyView> {
  const report = await weeklyReport(kitchenId, now, database);

  // GP, grouped by menu (menuGps keeps menu order and dish order).
  const menus: MoneyView['menus'] = [];
  for (const gp of report.gp) {
    let group = menus.find((m) => m.menu.id === gp.menuId);
    if (!group) menus.push((group = { menu: { id: gp.menuId, name: gp.menuName }, dishes: [] }));
    group.dishes.push(gp);
  }

  const componentIds = await menuComponents(kitchenId, database);
  const products = await database.products.toArray();
  const recipes: RecipeCost[] = [];
  const unpriced = new Map<Id, UnpricedIngredient>();
  for (const id of componentIds) {
    const component = await database.components.get(id);
    if (!component) continue;
    recipes.push({ componentId: id, name: component.name, cost: await componentCost(id, kitchenId, database) });

    const variation = await getVariationInUse(id, kitchenId, database);
    if (!variation?.currentVersionId) continue;
    for (const line of await database.lines.where('versionId').equals(variation.currentVersionId).toArray()) {
      if (!line.ingredientId) continue;
      const product = productForLine(line, products, variation.kitchenId ?? kitchenId);
      const anyPriced = products.some((p) => p.ingredientId === line.ingredientId && p.price !== null && p.pack);
      if ((product && product.price !== null && product.pack) || anyPriced) continue;
      const ingredient = await database.ingredients.get(line.ingredientId);
      const entry = unpriced.get(line.ingredientId) ?? { ingredientId: line.ingredientId, name: ingredient?.name ?? 'An ingredient', usedIn: [] };
      if (!entry.usedIn.includes(component.name)) entry.usedIn.push(component.name);
      unpriced.set(line.ingredientId, entry);
    }
  }

  return {
    menus,
    unpriced: [...unpriced.values()].sort((a, b) => b.usedIn.length - a.usedIn.length || a.name.localeCompare(b.name)),
    recipes: recipes.sort((a, b) => a.name.localeCompare(b.name)),
    week: { stock: report.stock, waste: report.waste, start: report.start, end: report.end },
  };
}

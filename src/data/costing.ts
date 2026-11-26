/**
 * Costing (SPEC → Section admin; A1; DECISIONS 53). The chef's working
 * figures, worked out each time from product prices: never stored, so a
 * price change shows everywhere at once.
 */

import { costPerUnit, grossProfitPercent, lineCost, type PackPrice } from '../core/costing/costing';
import type { Weights } from '../core/scaling/scaling';
import { convertAmount } from '../core/scaling/scaling';
import { db as appDb, type MepDatabase } from './db';
import { getDishDetails, getVariationInUse } from './library';
import { productForLine } from './products';
import type { Id, KitchenId, Line, Product } from './types';

export interface ComponentCost {
  /** The whole batch as written, in pence. */
  batch: number;
  /** What the recipe makes, if set: costs per unit of it. */
  yield: { amount: number; unit: string } | null;
  /** Pence per unit of the yield; null with no yield set. */
  perUnit: number | null;
  /** Lines that couldn't be costed: "salt (no amount)", "chives (no price)". */
  missing: string[];
}

/** The pack price of a line's product in this kitchen (the chosen or only one; else the first with a price). */
function packFor(line: Pick<Line, 'productId' | 'ingredientId'>, products: readonly Product[], kitchenId: KitchenId): PackPrice | null {
  const priced = (p: Product | null | undefined) => (p && p.price !== null && p.pack ? { amount: p.pack.amount, unit: p.pack.unit, price: p.price } : null);
  const chosen = priced(productForLine(line, products, kitchenId));
  if (chosen) return chosen;
  for (const p of products) if (p.ingredientId === line.ingredientId && p.kitchenId === kitchenId && priced(p)) return priced(p);
  return null;
}

async function costComponent(componentId: Id, kitchenId: KitchenId, products: Product[], seen: Set<Id>, database: MepDatabase): Promise<ComponentCost> {
  const variation = await getVariationInUse(componentId, kitchenId, database);
  const result: ComponentCost = { batch: 0, yield: variation?.baseYield ?? null, perUnit: null, missing: [] };
  if (!variation?.currentVersionId || seen.has(componentId)) return result;
  seen.add(componentId);
  const productKitchen = variation.kitchenId ?? kitchenId;
  for (const line of await database.lines.where('versionId').equals(variation.currentVersionId).sortBy('order')) {
    const row = line.ingredientId ? await database.ingredients.get(line.ingredientId) : line.componentId ? await database.components.get(line.componentId) : undefined;
    const name = (row?.name ?? 'an ingredient').toLowerCase();
    if (line.quantity === null) {
      result.missing.push(`${name} (no amount)`);
      continue;
    }
    const unit = line.unit ?? 'each';
    if (line.componentId) {
      const sub = await costComponent(line.componentId, kitchenId, products, seen, database);
      const amount = sub.yield ? convertAmount(line.quantity, unit, sub.yield.unit) : null;
      if (sub.perUnit === null || amount === null) result.missing.push(`${name} (${sub.yield ? 'can’t compare its units' : 'set what it makes'})`);
      else result.batch += amount * sub.perUnit;
      result.missing.push(...sub.missing.map((m) => `${m} in ${name}`));
      continue;
    }
    const ingredient = line.ingredientId ? await database.ingredients.get(line.ingredientId) : undefined;
    const weights: Weights = { density: ingredient?.density, unitWeights: ingredient?.unitWeights };
    const cost = lineCost(line.quantity, unit, packFor(line, products, productKitchen), weights, ingredient?.yieldLossPercent ?? null);
    if (cost === null) result.missing.push(`${name} (no price)`);
    else result.batch += cost;
  }
  seen.delete(componentId);
  result.batch = Math.round(result.batch);
  result.perUnit = result.yield ? costPerUnit(result.batch, result.yield.amount) : null;
  return result;
}

/** What a component costs to make, through every component it uses. */
export async function componentCost(componentId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<ComponentCost> {
  return costComponent(componentId, kitchenId, await database.products.toArray(), new Set(), database);
}

export interface DishCost {
  /** Per portion, in pence. */
  perPortion: number;
  /** Components with no amount per portion, or no cost per unit. */
  missing: string[];
}

/** A dish's cost per portion: each component's amount per portion × its cost per unit (A1). */
export async function dishCost(dishId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<DishCost> {
  const details = await getDishDetails(dishId, database);
  const products = await database.products.toArray();
  const result: DishCost = { perPortion: 0, missing: [] };
  for (const { link, component } of details?.components ?? []) {
    const cost = await costComponent(component.id, kitchenId, products, new Set(), database);
    const per = link.quantityPerPortion;
    const amount = per && cost.yield ? convertAmount(per.amount, per.unit, cost.yield.unit) : null;
    if (!per) result.missing.push(`${component.name} (no amount per portion)`);
    else if (cost.perUnit === null || amount === null) result.missing.push(`${component.name} (${cost.yield ? 'can’t compare its units' : 'set what it makes'})`);
    else result.perPortion += amount * cost.perUnit;
    result.missing.push(...cost.missing.map((m) => `${m} in ${component.name.toLowerCase()}`));
  }
  result.perPortion = Math.round(result.perPortion);
  return result;
}

export interface MenuDishGp {
  menuDishId: Id;
  dishId: Id;
  dishName: string;
  menuId: Id;
  menuName: string;
  price: number | null;
  cost: DishCost;
  gp: number | null;
  target: number | null;
  /** GP is below the dish's target on this menu. */
  belowTarget: boolean;
}

/** GP% for every dish on a kitchen's menus on now (or one menu), against its target (A1). */
export async function menuGps(kitchenId: KitchenId, menuId?: Id, database: MepDatabase = appDb): Promise<MenuDishGp[]> {
  const menus = (await database.menus.where('kitchenId').equals(kitchenId).toArray()).filter((m) => (menuId ? m.id === menuId : m.status === 'on-now'));
  const out: MenuDishGp[] = [];
  for (const menu of menus) {
    for (const place of await database.menuDishes.where('menuId').equals(menu.id).sortBy('order')) {
      const dish = await database.dishes.get(place.dishId);
      if (!dish) continue;
      const cost = await dishCost(dish.id, kitchenId, database);
      const gp = grossProfitPercent(place.price, cost.perPortion);
      out.push({
        menuDishId: place.id,
        dishId: dish.id,
        dishName: dish.name,
        menuId: menu.id,
        menuName: menu.name,
        price: place.price,
        cost,
        gp,
        target: place.targetGpPercent,
        belowTarget: gp !== null && place.targetGpPercent !== null && gp < place.targetGpPercent,
      });
    }
  }
  return out;
}

/** What an amount of a component or ingredient costs, for stock value and waste. null if it can't be costed. */
export async function itemCost(
  target: { componentId: Id | null; ingredientId: Id | null },
  quantity: { amount: number; unit: string },
  kitchenId: KitchenId,
  database: MepDatabase = appDb,
): Promise<number | null> {
  if (target.componentId) {
    const cost = await componentCost(target.componentId, kitchenId, database);
    const amount = cost.yield ? convertAmount(quantity.amount, quantity.unit, cost.yield.unit) : null;
    return cost.perUnit !== null && amount !== null ? Math.round(amount * cost.perUnit) : null;
  }
  if (!target.ingredientId) return null;
  const ingredient = await database.ingredients.get(target.ingredientId);
  const products = await database.products.where('ingredientId').equals(target.ingredientId).toArray();
  const cost = lineCost(quantity.amount, quantity.unit, packFor({ productId: null, ingredientId: target.ingredientId }, products, kitchenId), {
    density: ingredient?.density,
    unitWeights: ingredient?.unitWeights,
  });
  return cost === null ? null : Math.round(cost);
}

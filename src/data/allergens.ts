/**
 * Allergens through components (SPEC → Food safety; FS1, FS5; DECISIONS 52).
 *
 * Worked out, never stored: from each recipe line's ingredient (a basic
 * ingredient's own allergens; a bought-in one's product), through every
 * component it uses, for the variation in use (or the one being looked at).
 * Each allergen says where it comes from ("mustard: Dijon via rémoulade").
 * A bought-in ingredient with no product is "not confirmed", and the list
 * is never called complete while anything is.
 */

import { summariseAllergens, type AllergenSource, type AllergenSummary } from '../core/allergens/allergens';
import { db as appDb, type MepDatabase } from './db';
import { getPlace } from './kitchens';
import { getDishDetails, getVariationInUse } from './library';
import { isConfirmed, productForLine } from './products';
import type { Id, KitchenId, Product } from './types';

/** A line that needs its product chosen ("which mayonnaise?"), with where it is. */
export interface UnconfirmedLine {
  lineId: Id;
  ingredientId: Id;
  ingredientName: string;
  /** The component whose recipe the line is in. */
  componentId: Id;
  componentName: string;
  /** Its product, when there is one but its label isn't checked yet. */
  productId: Id | null;
}

export interface Allergens extends AllergenSummary {
  /** The lines to fix, each one tap from the summary. */
  toConfirm: UnconfirmedLine[];
}

async function walk(
  componentId: Id,
  kitchenId: KitchenId,
  via: string[],
  sources: AllergenSource[],
  toConfirm: UnconfirmedLine[],
  unrecorded: string[],
  products: Product[],
  seen: Set<Id>,
  database: MepDatabase,
  variationId?: Id | null,
) {
  if (seen.has(componentId)) return;
  seen.add(componentId);
  const component = await database.components.get(componentId);
  const chosen = variationId ? await database.variations.get(variationId) : undefined;
  const variation = chosen?.componentId === componentId ? chosen : await getVariationInUse(componentId, kitchenId, database);
  const lines = variation?.currentVersionId ? await database.lines.where('versionId').equals(variation.currentVersionId).sortBy('order') : [];
  // A part with nothing recorded: its allergens aren't known, so neither are the whole's.
  if (!lines.some((l) => l.ingredientId || l.componentId)) {
    const name = component?.name ?? 'A component';
    unrecorded.push(via.length > 1 ? `${name} (via ${via.slice(0, -1).join(' → ')})` : name);
    seen.delete(componentId);
    return;
  }
  // A house recipe's lines use that kitchen's products; the chef's own use the kitchen they're in.
  const productKitchen = variation?.kitchenId ?? kitchenId;
  for (const line of lines) {
    if (line.componentId) {
      const used = await database.components.get(line.componentId);
      await walk(line.componentId, kitchenId, [...via, used?.name ?? 'a component'], sources, toConfirm, unrecorded, products, seen, database);
      continue;
    }
    if (!line.ingredientId) continue;
    const ingredient = await database.ingredients.get(line.ingredientId);
    if (!ingredient) continue;
    if (ingredient.kind === 'basic') {
      sources.push({ ingredient: ingredient.name, via, contains: ingredient.allergens, mayContain: [], unconfirmed: false });
      continue;
    }
    const product = productForLine(line, products, productKitchen);
    const confirmed = product !== null && isConfirmed(product);
    sources.push({ ingredient: ingredient.name, via, contains: product?.contains ?? [], mayContain: product?.mayContain ?? [], unconfirmed: !confirmed });
    if (!confirmed) {
      toConfirm.push({ lineId: line.id, ingredientId: ingredient.id, ingredientName: ingredient.name, componentId, componentName: component?.name ?? '', productId: product?.id ?? null });
    }
  }
  seen.delete(componentId);
}

/** A component's allergens (its own recipe and everything it uses). */
export async function componentAllergens(componentId: Id, kitchenId: KitchenId, variationId?: Id | null, database: MepDatabase = appDb): Promise<Allergens> {
  const sources: AllergenSource[] = [];
  const toConfirm: UnconfirmedLine[] = [];
  const unrecorded: string[] = [];
  const products = await database.products.toArray();
  await walk(componentId, kitchenId, [], sources, toConfirm, unrecorded, products, new Set(), database, variationId);
  // The component itself being empty is said by `empty`; only name its parts.
  return { ...summariseAllergens(sources, sources.length ? unrecorded : []), toConfirm };
}

/** A dish's allergens, gathered from all its components (MS2, FS1). */
export async function dishAllergens(dishId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Allergens> {
  const details = await getDishDetails(dishId, database);
  const sources: AllergenSource[] = [];
  const toConfirm: UnconfirmedLine[] = [];
  const unrecorded: string[] = [];
  const products = await database.products.toArray();
  for (const { component } of details?.components ?? []) {
    await walk(component.id, kitchenId, [component.name], sources, toConfirm, unrecorded, products, new Set(), database);
  }
  return { ...summariseAllergens(sources, sources.length ? unrecorded : []), toConfirm };
}

/** For the current kitchen. */
export async function dishAllergensHere(dishId: Id, database: MepDatabase = appDb) {
  return dishAllergens(dishId, (await getPlace(database)).kitchenId, database);
}

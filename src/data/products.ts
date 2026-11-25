/**
 * Products for bought-in ingredients (SPEC → Ingredients; FS5; DECISIONS 52).
 *
 * A bought-in ingredient ("mayonnaise") points at the exact product each
 * kitchen uses: supplier, brand, pack, what it contains and may contain
 * (kept separate), a photo of the label and when it was checked.
 *
 * Which product a recipe line uses: the one chosen on the line; otherwise,
 * if this kitchen has exactly one for that ingredient, that one; otherwise
 * none, and the line is "not confirmed", never allergen-free.
 */

import { cleanName } from '../core/lists/lists';
import { toCalendarDate } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { getIngredientDetails } from './library';
import { ListError } from './lists';
import type { Snapshot } from './snapshot';
import type { Id, KitchenId, Line, Product, Supplier } from './types';

export async function listProducts(ingredientId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Product[]> {
  return (await database.products.where('ingredientId').equals(ingredientId).toArray())
    .filter((p) => p.kitchenId === kitchenId)
    .sort((a, b) => a.brand.localeCompare(b.brand));
}

export async function createProduct(ingredientId: Id, kitchenId: KitchenId, brand: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(brand);
  if (!cleaned) throw new ListError('Say whose it is: the brand or supplier’s name for it.');
  return database.products.add({
    ingredientId,
    kitchenId,
    supplierId: null,
    brand: cleaned,
    pack: null,
    contains: [],
    mayContain: [],
    labelPhotoId: null,
    checkedOn: null,
    price: null,
    priceDate: null,
  });
}

/**
 * Changes a product. When what it contains changes, everything that uses it
 * is worked out again (allergens are never stored), and this returns the
 * components and dishes affected, so the chef can be told (FS5: "changing a
 * product re-checks every component that uses it").
 */
export async function updateProduct(
  id: Id,
  changes: Partial<Pick<Product, 'brand' | 'supplierId' | 'pack' | 'contains' | 'mayContain' | 'checkedOn' | 'price' | 'priceDate'>>,
  database: MepDatabase = appDb,
): Promise<{ components: string[]; dishes: string[] }> {
  const before = await database.products.get(id);
  await database.products.update(id, changes);
  const allergensChanged =
    before && ((changes.contains && changes.contains.join() !== before.contains.join()) || (changes.mayContain && changes.mayContain.join() !== before.mayContain.join()));
  if (!before || !allergensChanged) return { components: [], dishes: [] };
  return usersOfIngredient(before.ingredientId, database);
}

/** "Checked today": the date the label was last checked against the product. */
export async function markChecked(id: Id, now = new Date(), database: MepDatabase = appDb) {
  await database.products.update(id, { checkedOn: toCalendarDate(now) });
}

export async function setProductLabelPhoto(id: Id, photo: Blob | null, database: MepDatabase = appDb) {
  await database.transaction('rw', database.products, database.media, async () => {
    const product = await database.products.get(id);
    if (!product) return;
    if (product.labelPhotoId) await database.media.delete(product.labelPhotoId);
    const labelPhotoId = photo ? await database.media.add({ blob: photo, type: photo.type || 'image/jpeg' }) : null;
    await database.products.update(id, { labelPhotoId });
  });
}

/** Deletes a product; lines that chose it go back to "not confirmed" (unless one product is left). Returns a snapshot for Undo. */
export async function deleteProduct(id: Id, database: MepDatabase = appDb): Promise<Snapshot> {
  return database.transaction('rw', [database.products, database.lines, database.media], async () => {
    const product = await database.products.get(id);
    const lines = await database.lines.where('productId').equals(id).toArray();
    const media = product?.labelPhotoId ? await database.media.get(product.labelPhotoId) : undefined;
    await database.products.delete(id);
    for (const line of lines) await database.lines.update(line.id, { productId: null });
    if (media) await database.media.delete(media.id);
    return { products: product ? [product] : [], lines, media: media ? [media] : [] };
  });
}

/** Chooses the product a recipe line uses (FS5: "which mayonnaise?"). */
export async function setLineProduct(lineId: Id, productId: Id | null, database: MepDatabase = appDb) {
  await database.lines.update(lineId, { productId });
}

/** The product a line uses in a kitchen: chosen, or the only one there is; else null ("not confirmed"). */
export function productForLine(line: Pick<Line, 'productId' | 'ingredientId'>, products: readonly Product[], kitchenId: KitchenId): Product | null {
  const chosen = line.productId ? products.find((p) => p.id === line.productId) : undefined;
  if (chosen) return chosen;
  const here = products.filter((p) => p.ingredientId === line.ingredientId && p.kitchenId === kitchenId);
  return here.length === 1 ? here[0]! : null;
}

/** Components (current recipes) and dishes that use an ingredient, directly or through other components. */
async function usersOfIngredient(ingredientId: Id, database: MepDatabase): Promise<{ components: string[]; dishes: string[] }> {
  const details = await getIngredientDetails(ingredientId, database);
  return { components: (details?.components ?? []).map((c) => c.name), dishes: (details?.dishes ?? []).map((d) => d.name) };
}

// ─── Suppliers ────────────────────────────────────────────────────────────

export function listSuppliers(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Supplier[]> {
  return database.suppliers.where('kitchenId').equals(kitchenId).sortBy('name');
}

/** A kitchen's supplier by name, made if it's new. Returns its id. */
export async function ensureSupplier(kitchenId: KitchenId, name: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the supplier a name.');
  const existing = (await listSuppliers(kitchenId, database)).find((s) => s.name.toLowerCase() === cleaned.toLowerCase());
  if (existing) return existing.id;
  return database.suppliers.add({ kitchenId, name: cleaned, contact: '', cutOff: null, minimumOrder: null, deliveryDays: [] });
}

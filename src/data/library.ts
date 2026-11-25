/**
 * The library (SPEC → The library, Components, Ingredients): components with
 * their lines and steps, dishes made of components, and ingredients with
 * everything that uses them.
 *
 * Phase 2 edits a variation's current version in place; Phase 6 makes every
 * edit a new version.
 */

import { capitalise, findByName } from '../core/ingredients/names';
import type { ShorthandLine } from '../core/ingredients/shorthand';
import { cleanName } from '../core/lists/lists';
import { createDraftComponent } from './components';
import { db as appDb, type MepDatabase } from './db';
import { ListError } from './lists';
import type { Snapshot } from './snapshot';
import type { Component, Dish, DishComponent, Id, Ingredient, KitchenId, Line, Quantity, Step, Variation } from './types';

// ─── Variations ───────────────────────────────────────────────────────────

/**
 * The variation in use (V4): this kitchen's house variation first, then the
 * chef's own, then any other, oldest first.
 */
export async function getVariationInUse(
  componentId: Id,
  kitchenId: KitchenId,
  database: MepDatabase = appDb,
): Promise<Variation | undefined> {
  const variations = (await database.variations.where('componentId').equals(componentId).toArray()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  return (
    variations.find((v) => v.source === 'house' && v.kitchenId === kitchenId) ??
    variations.find((v) => v.source === 'mine') ??
    variations[0]
  );
}

/** The variation's current version id, creating the first version if there isn't one. */
async function currentVersionId(variation: Variation, database: MepDatabase): Promise<Id> {
  if (variation.currentVersionId) return variation.currentVersionId;
  const versionId = await database.versions.add({ variationId: variation.id, parentId: null, changeNote: null });
  await database.variations.update(variation.id, { currentVersionId: versionId });
  return versionId;
}

// ─── Components ───────────────────────────────────────────────────────────

export interface LineView {
  line: Line;
  /** The ingredient's or component's name. */
  name: string;
  target: { kind: 'ingredient' | 'component'; id: Id } | null;
}

export interface ComponentDetails {
  component: Component;
  variation: Variation | undefined;
  lines: LineView[];
  steps: Step[];
  /** Dishes this component is part of. */
  dishes: Dish[];
  /** Components whose lines use this one ("the jus uses the stock"). */
  usedInComponents: Component[];
}

export async function getComponentDetails(
  id: Id,
  kitchenId: KitchenId,
  database: MepDatabase = appDb,
): Promise<ComponentDetails | undefined> {
  const component = await database.components.get(id);
  if (!component) return undefined;
  const variation = await getVariationInUse(id, kitchenId, database);
  const versionId = variation?.currentVersionId;
  const lines = versionId ? await database.lines.where('versionId').equals(versionId).sortBy('order') : [];
  const steps = versionId ? await database.steps.where('versionId').equals(versionId).sortBy('order') : [];

  const ingredients = await database.ingredients.bulkGet(lines.map((l) => l.ingredientId).filter(isId));
  const components = await database.components.bulkGet(lines.map((l) => l.componentId).filter(isId));
  const names = new Map<Id, string>();
  for (const row of [...ingredients, ...components]) if (row) names.set(row.id, row.name);

  const links = await database.dishComponents.where('componentId').equals(id).toArray();
  const dishes = (await database.dishes.bulkGet([...new Set(links.map((l) => l.dishId))])).filter(isDefined);

  return {
    component,
    variation,
    lines: lines.map((line) => {
      const target = line.componentId
        ? { kind: 'component' as const, id: line.componentId }
        : line.ingredientId
          ? { kind: 'ingredient' as const, id: line.ingredientId }
          : null;
      return { line, name: (target && names.get(target.id)) ?? '?', target };
    }),
    steps,
    dishes: dishes.sort(byName),
    usedInComponents: await componentsUsing({ kind: 'component', id }, database),
  };
}

/** Creates a component with one draft variation (house here, or the chef's own). */
export async function createComponent(name: string, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Id> {
  const { componentId } = await createDraftComponent(name, kitchenId, database, 'Created');
  return componentId;
}

export async function updateComponent(
  id: Id,
  changes: Partial<Pick<Component, 'name' | 'typeId' | 'tagIds' | 'aliases'>>,
  database: MepDatabase = appDb,
) {
  if (changes.name !== undefined) {
    const name = cleanName(changes.name);
    if (!name) throw new ListError('Give the component a name.');
    changes = { ...changes, name };
  }
  await database.components.update(id, changes);
}

export async function setBaseYield(variationId: Id, baseYield: Quantity | null, database: MepDatabase = appDb) {
  await database.variations.update(variationId, { baseYield });
}

/**
 * Saves a component's ingredient lines from shorthand (R1). Each name is
 * matched to another component first ("chicken stock" → the stock), then to
 * an ingredient by name or alias; anything unknown becomes a new ingredient.
 * Rows are updated in place by position, so ids stay stable.
 * Returns the ids of ingredients it had to create.
 */
export async function saveLines(
  variationId: Id,
  parsed: ShorthandLine[],
  database: MepDatabase = appDb,
): Promise<Id[]> {
  const created: Id[] = [];
  await database.transaction('rw', [database.variations, database.versions, database.lines, database.ingredients, database.components], async () => {
    const variation = await database.variations.get(variationId);
    if (!variation) throw new Error('That variation no longer exists.');
    const versionId = await currentVersionId(variation, database);
    const existing = await database.lines.where('versionId').equals(versionId).sortBy('order');
    const components = (await database.components.toArray()).filter((c) => c.id !== variation.componentId);
    const ingredients = await database.ingredients.toArray();

    for (const [order, item] of parsed.entries()) {
      const component = findByName(components, item.name);
      let ingredientId: Id | null = null;
      if (!component) {
        let ingredient = findByName(ingredients, item.name);
        if (!ingredient) {
          const id = await database.ingredients.add(newIngredient(item.name));
          created.push(id);
          ingredient = (await database.ingredients.get(id))!;
          ingredients.push(ingredient);
        }
        ingredientId = ingredient.id;
      }
      const previous = existing[order];
      const sameTarget = previous && previous.ingredientId === ingredientId && previous.componentId === (component?.id ?? null);
      const row = {
        versionId,
        ingredientId,
        componentId: component?.id ?? null,
        // A chosen product stays only while the line still means the same ingredient.
        productId: sameTarget ? previous.productId : null,
        quantity: item.quantity,
        unit: item.unit,
        prepNote: item.prepNote,
        order,
      };
      if (previous) await database.lines.update(previous.id, row);
      else await database.lines.add(row);
    }
    await database.lines.bulkDelete(existing.slice(parsed.length).map((l) => l.id));
  });
  return created;
}

/**
 * Deletes those of these ingredients that nothing uses: the ones an editing
 * session created while a name was half-typed ("bon" before "bones").
 */
export async function deleteUnusedIngredients(ids: Id[], database: MepDatabase = appDb): Promise<void> {
  for (const id of ids) {
    try {
      await deleteIngredient(id, database);
    } catch {
      // Still used: keep it.
    }
  }
}

/** Saves the method as plain steps, one per line (Phase 4 reads them). */
export async function saveSteps(variationId: Id, texts: string[], database: MepDatabase = appDb): Promise<void> {
  const cleaned = texts.map((t) => t.trim()).filter(Boolean);
  await database.transaction('rw', [database.variations, database.versions, database.steps], async () => {
    const variation = await database.variations.get(variationId);
    if (!variation) throw new Error('That variation no longer exists.');
    const versionId = await currentVersionId(variation, database);
    const existing = await database.steps.where('versionId').equals(versionId).sortBy('order');
    for (const [order, text] of cleaned.entries()) {
      const previous = existing[order];
      if (previous) {
        // Changed wording means the reader's old readings no longer apply.
        if (previous.text !== text) await database.steps.update(previous.id, { text, order, confirmed: false });
        else if (previous.order !== order) await database.steps.update(previous.id, { order });
      } else {
        await database.steps.add(newStep(versionId, order, text));
      }
    }
    await database.steps.bulkDelete(existing.slice(cleaned.length).map((s) => s.id));
  });
}

export interface ComponentSummary {
  component: Component;
  dishCount: number;
  status: 'draft' | 'ready';
}

export async function listComponentSummaries(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<ComponentSummary[]> {
  const [components, links] = await Promise.all([database.components.orderBy('name').toArray(), database.dishComponents.toArray()]);
  return Promise.all(
    components.map(async (component) => ({
      component,
      dishCount: new Set(links.filter((l) => l.componentId === component.id).map((l) => l.dishId)).size,
      status: (await getVariationInUse(component.id, kitchenId, database))?.status ?? 'draft',
    })),
  );
}

/**
 * Deletes a component with its variations, versions, lines and steps, takes
 * it off any dish, and returns its notes to the inbox. Refused while another
 * component's lines use it. Returns what Undo needs.
 */
export async function deleteComponent(id: Id, database: MepDatabase = appDb): Promise<Snapshot> {
  const users = await componentsUsing({ kind: 'component', id }, database);
  if (users.length) throw new ListError(`It’s used in ${users.map((c) => c.name).join(', ')}. Remove it there first.`);

  return database.transaction('rw', database.tables, async () => {
    const component = await database.components.get(id);
    const variations = await database.variations.where('componentId').equals(id).toArray();
    const versions = await database.versions.where('variationId').anyOf(variations.map((v) => v.id)).toArray();
    const versionIds = versions.map((v) => v.id);
    const lines = await database.lines.where('versionId').anyOf(versionIds).toArray();
    const steps = await database.steps.where('versionId').anyOf(versionIds).toArray();
    const dishComponents = await database.dishComponents.where('componentId').equals(id).toArray();
    const notes = await database.notes
      .where('kind')
      .equals('attempt')
      .filter((n) => n.links.some((link) => link.kind === 'component' && link.id === id))
      .toArray();

    await database.components.delete(id);
    await database.variations.bulkDelete(variations.map((v) => v.id));
    await database.versions.bulkDelete(versionIds);
    await database.lines.bulkDelete(lines.map((l) => l.id));
    await database.steps.bulkDelete(steps.map((s) => s.id));
    await database.dishComponents.bulkDelete(dishComponents.map((d) => d.id));
    for (const note of notes) {
      const variationIds = new Set(variations.map((v) => v.id));
      await database.notes.update(note.id, {
        kind: 'inbox',
        links: note.links.filter((l) => !(l.kind === 'component' && l.id === id) && !(l.kind === 'variation' && variationIds.has(l.id))),
      });
    }
    return {
      components: component ? [component] : [],
      variations,
      versions,
      lines,
      steps,
      dishComponents,
      notes,
    };
  });
}

// ─── Dishes ───────────────────────────────────────────────────────────────

export async function createDish(name: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the dish a name.');
  return database.dishes.add({ name: cleaned, description: '', platingPhotoId: null, platingSpec: '', tagIds: [] });
}

export interface DishDetails {
  dish: Dish;
  components: { link: DishComponent; component: Component }[];
}

export async function getDishDetails(id: Id, database: MepDatabase = appDb): Promise<DishDetails | undefined> {
  const dish = await database.dishes.get(id);
  if (!dish) return undefined;
  const links = await database.dishComponents.where('dishId').equals(id).sortBy('order');
  const components = await database.components.bulkGet(links.map((l) => l.componentId));
  return {
    dish,
    components: links.flatMap((link, i) => (components[i] ? [{ link, component: components[i] }] : [])),
  };
}

export async function updateDish(
  id: Id,
  changes: Partial<Pick<Dish, 'name' | 'description' | 'platingSpec' | 'tagIds'>>,
  database: MepDatabase = appDb,
) {
  if (changes.name !== undefined) {
    const name = cleanName(changes.name);
    if (!name) throw new ListError('Give the dish a name.');
    changes = { ...changes, name };
  }
  await database.dishes.update(id, changes);
}

/** Sets or clears the plating photo; the old photo is deleted. */
export async function setDishPhoto(id: Id, photo: Blob | null, database: MepDatabase = appDb) {
  await database.transaction('rw', database.dishes, database.media, async () => {
    const dish = await database.dishes.get(id);
    if (!dish) return;
    if (dish.platingPhotoId) await database.media.delete(dish.platingPhotoId);
    const platingPhotoId = photo ? await database.media.add({ blob: photo, type: photo.type || 'image/jpeg' }) : null;
    await database.dishes.update(id, { platingPhotoId });
  });
}

export async function addComponentToDish(dishId: Id, componentId: Id, database: MepDatabase = appDb) {
  const links = await database.dishComponents.where('dishId').equals(dishId).toArray();
  if (links.some((l) => l.componentId === componentId)) return;
  await database.dishComponents.add({
    dishId,
    componentId,
    quantityPerPortion: null,
    order: links.reduce((max, l) => Math.max(max, l.order + 1), 0),
  });
}

/** Takes a component off a dish (the component itself stays). Returns the link for Undo. */
export async function removeComponentFromDish(linkId: Id, database: MepDatabase = appDb) {
  const link = await database.dishComponents.get(linkId);
  await database.dishComponents.delete(linkId);
  return link;
}

export async function moveDishComponent(dishId: Id, linkId: Id, direction: -1 | 1, database: MepDatabase = appDb) {
  const links = await database.dishComponents.where('dishId').equals(dishId).sortBy('order');
  const from = links.findIndex((l) => l.id === linkId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= links.length) return;
  const [moved] = links.splice(from, 1);
  links.splice(to, 0, moved!);
  await database.transaction('rw', database.dishComponents, async () => {
    for (const [order, link] of links.entries()) await database.dishComponents.update(link.id, { order });
  });
}

export async function listDishSummaries(database: MepDatabase = appDb) {
  const [dishes, links] = await Promise.all([database.dishes.orderBy('name').toArray(), database.dishComponents.toArray()]);
  return dishes.map((dish) => ({ dish, componentCount: links.filter((l) => l.dishId === dish.id).length }));
}

/** Deletes a dish and its component links (not the components). Returns what Undo needs. */
export async function deleteDish(id: Id, database: MepDatabase = appDb): Promise<Snapshot> {
  return database.transaction('rw', database.dishes, database.dishComponents, database.media, async () => {
    const dish = await database.dishes.get(id);
    const dishComponents = await database.dishComponents.where('dishId').equals(id).toArray();
    const media = dish?.platingPhotoId ? await database.media.get(dish.platingPhotoId) : undefined;
    await database.dishes.delete(id);
    await database.dishComponents.bulkDelete(dishComponents.map((d) => d.id));
    if (media) await database.media.delete(media.id);
    return { dishes: dish ? [dish] : [], dishComponents, media: media ? [media] : [] };
  });
}

// ─── Ingredients ──────────────────────────────────────────────────────────

function newIngredient(name: string): Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> {
  return { name: capitalise(cleanName(name)), aliases: [], kind: 'basic', allergens: [], density: null, yieldLossPercent: null };
}

/** Finds an ingredient by name or alias, or creates it. */
export async function createIngredient(name: string, database: MepDatabase = appDb): Promise<Id> {
  if (!cleanName(name)) throw new ListError('Give the ingredient a name.');
  const existing = findByName(await database.ingredients.toArray(), name);
  return existing ? existing.id : database.ingredients.add(newIngredient(name));
}

export function listIngredients(database: MepDatabase = appDb): Promise<Ingredient[]> {
  return database.ingredients.orderBy('name').toArray();
}

export async function updateIngredient(
  id: Id,
  changes: Partial<Pick<Ingredient, 'name' | 'aliases' | 'kind' | 'allergens'>>,
  database: MepDatabase = appDb,
) {
  if (changes.name !== undefined) {
    const name = cleanName(changes.name);
    if (!name) throw new ListError('Give the ingredient a name.');
    changes = { ...changes, name };
  }
  await database.ingredients.update(id, changes);
}

/**
 * Everything that uses an ingredient (I1): the components whose current
 * recipe lists it, the components that use those (the jus uses the stock that
 * uses the bones), and every dish made from any of them.
 */
export async function getIngredientDetails(id: Id, database: MepDatabase = appDb) {
  const ingredient = await database.ingredients.get(id);
  if (!ingredient) return undefined;
  const components = await componentsUsing({ kind: 'ingredient', id }, database, true);
  const links = await database.dishComponents.where('componentId').anyOf(components.map((c) => c.id)).toArray();
  const dishes = (await database.dishes.bulkGet([...new Set(links.map((l) => l.dishId))])).filter(isDefined);
  return { ingredient, components, dishes: dishes.sort(byName) };
}

/** Deletes an ingredient nothing uses. Returns it for Undo. */
export async function deleteIngredient(id: Id, database: MepDatabase = appDb): Promise<Ingredient | undefined> {
  const [lines, products, items, waste] = await Promise.all([
    database.lines.where('ingredientId').equals(id).count(),
    database.products.where('ingredientId').equals(id).count(),
    database.sectionItems.where('ingredientId').equals(id).count(),
    database.wasteEntries.filter((w) => w.ingredientId === id).count(),
  ]);
  if (lines + products + items + waste > 0) throw new ListError('It’s still used, so it can’t be deleted. Remove it from those recipes first.');
  const ingredient = await database.ingredients.get(id);
  await database.ingredients.delete(id);
  return ingredient;
}

// ─── Who uses what ────────────────────────────────────────────────────────

/**
 * Components whose current recipe uses an ingredient or another component.
 * With `transitive`, also the components that use those, and so on.
 */
async function componentsUsing(
  target: { kind: 'ingredient' | 'component'; id: Id },
  database: MepDatabase,
  transitive = false,
): Promise<Component[]> {
  const variations = await database.variations.toArray();
  // Only current versions count: an old version's lines aren't the recipe any more.
  const currentVersions = new Map(variations.filter((v) => v.currentVersionId).map((v) => [v.currentVersionId!, v.componentId]));

  const found = new Set<Id>();
  let frontier = [target];
  while (frontier.length) {
    const next: { kind: 'component'; id: Id }[] = [];
    for (const item of frontier) {
      const lines = await database.lines.where(item.kind === 'ingredient' ? 'ingredientId' : 'componentId').equals(item.id).toArray();
      for (const line of lines) {
        const componentId = currentVersions.get(line.versionId);
        if (componentId && !found.has(componentId) && componentId !== target.id) {
          found.add(componentId);
          if (transitive) next.push({ kind: 'component', id: componentId });
        }
      }
    }
    frontier = next;
  }
  return (await database.components.bulkGet([...found])).filter(isDefined).sort(byName);
}

function isId(value: Id | null): value is Id {
  return value !== null;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name);
}

function newStep(versionId: Id, order: number, text: string): Omit<Step, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    versionId,
    order,
    text,
    mode: null,
    minutesMin: null,
    minutesMax: null,
    equipmentTypeId: null,
    equipmentSetting: null,
    dependsOnComponentIds: [],
    scalesWithLineId: null,
    hold: null,
    pausable: null,
    pauseBlocker: null,
    criticalPoint: null,
    atService: false,
    confirmed: false,
  };
}

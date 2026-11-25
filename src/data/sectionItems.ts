/**
 * A section's item list (SPEC → Sections): the components and ingredients
 * the section looks after, with pars. Used to fill the sheet quickly (SH2)
 * and, from Phase 11, for counts and orders.
 */

import { db as appDb, type MepDatabase } from './db';
import type { Id, Quantity, SectionItem } from './types';

export interface SectionItemView {
  item: SectionItem;
  name: string;
  kind: 'component' | 'ingredient';
}

/** A section's items in order, with their names. */
export async function listSectionItems(sectionId: Id, database: MepDatabase = appDb): Promise<SectionItemView[]> {
  const items = await database.sectionItems.where('sectionId').equals(sectionId).sortBy('order');
  const components = await database.components.bulkGet(items.map((i) => i.componentId ?? ''));
  const ingredients = await database.ingredients.bulkGet(items.map((i) => i.ingredientId ?? ''));
  return items.flatMap((item, index) => {
    const row = item.componentId ? components[index] : ingredients[index];
    return row ? [{ item, name: row.name, kind: item.componentId ? ('component' as const) : ('ingredient' as const) }] : [];
  });
}

/** Adds a component or ingredient to a section's list (once). */
export async function addSectionItem(
  sectionId: Id,
  target: { componentId: Id } | { ingredientId: Id },
  database: MepDatabase = appDb,
): Promise<Id> {
  const items = await database.sectionItems.where('sectionId').equals(sectionId).toArray();
  const componentId = 'componentId' in target ? target.componentId : null;
  const ingredientId = 'ingredientId' in target ? target.ingredientId : null;
  const existing = items.find((i) => i.componentId === componentId && i.ingredientId === ingredientId);
  if (existing) return existing.id;
  return database.sectionItems.add({
    sectionId,
    componentId,
    ingredientId,
    par: null,
    shelfPosition: null,
    order: items.reduce((max, i) => Math.max(max, i.order + 1), 0),
  });
}

export async function updateSectionItem(
  id: Id,
  changes: { par?: Quantity | null; shelfPosition?: string | null },
  database: MepDatabase = appDb,
) {
  await database.sectionItems.update(id, changes);
}

export async function moveSectionItem(sectionId: Id, id: Id, direction: -1 | 1, database: MepDatabase = appDb) {
  const items = await database.sectionItems.where('sectionId').equals(sectionId).sortBy('order');
  const from = items.findIndex((i) => i.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) return;
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved!);
  await database.transaction('rw', database.sectionItems, async () => {
    for (const [order, item] of items.entries()) await database.sectionItems.update(item.id, { order });
  });
}

/** Takes an item off the list. Returns it for Undo. */
export async function removeSectionItem(id: Id, database: MepDatabase = appDb) {
  const item = await database.sectionItems.get(id);
  await database.sectionItems.delete(id);
  return item;
}

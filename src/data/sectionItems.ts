/**
 * A section's item list (SPEC → Sections): the components and ingredients
 * the section looks after, with pars. Used to fill the sheet quickly (SH2)
 * and, from Phase 11, for counts and orders.
 */

import { db as appDb, type MepDatabase } from './db';
import { menuComponentsForSection } from './menus';
import { getSetting, setSetting } from './settings';
import type { Id, KitchenId, Quantity, SectionItem } from './types';

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

// ─── With the menus (MS4) ─────────────────────────────────────────────────

export interface SectionListEntry {
  /** Stable key for lists and trays. */
  key: string;
  name: string;
  /** The stored item (standing items and anything given a par); null for a component only on a menu. */
  stored: SectionItemView | null;
  componentId: Id | null;
  /** The menus on now that put it on this section: "À la carte". */
  menuNames: string[];
}

/**
 * A section's list as the chef uses it: what they've added (standing items,
 * pars), then what the menus on now give the section, so a new menu updates
 * the list by itself (SPEC → Menus and dishes).
 */
export async function listSectionEntries(sectionIds: Id[], database: MepDatabase = appDb): Promise<SectionListEntry[]> {
  const entries: SectionListEntry[] = [];
  const fromMenus = (await Promise.all(sectionIds.map((id) => menuComponentsForSection(id, database)))).flat();
  for (const sectionId of sectionIds) {
    for (const view of await listSectionItems(sectionId, database)) {
      const menuNames = view.item.componentId ? fromMenus.filter((m) => m.component.id === view.item.componentId).flatMap((m) => m.menuNames) : [];
      entries.push({ key: view.item.id, name: view.name, stored: view, componentId: view.item.componentId, menuNames: [...new Set(menuNames)] });
    }
  }
  for (const { component, menuNames } of fromMenus) {
    if (entries.some((e) => e.componentId === component.id)) continue;
    entries.push({ key: `menu-${component.id}`, name: component.name, stored: null, componentId: component.id, menuNames });
  }
  return entries;
}

// ─── Which section's list ─────────────────────────────────────────────────

const chosenKey = (kitchenId: KitchenId) => `sectionList.${kitchenId}`;

/**
 * The section list last looked at in this kitchen: the sheet's add tray and
 * the Section list open on it. Not "where the chef is" (DECISIONS 48), just
 * the last list they used; hopping to another is one tap on its chip.
 */
export async function getChosenSection(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Id | null> {
  const sections = (await database.sections.where('kitchenId').equals(kitchenId).toArray()).filter((s) => !s.hidden && !s.mergedIntoId);
  const saved = await getSetting<Id>(chosenKey(kitchenId), database);
  return sections.find((s) => s.id === saved)?.id ?? sections.sort((a, b) => a.order - b.order)[0]?.id ?? null;
}

export async function setChosenSection(kitchenId: KitchenId, sectionId: Id, database: MepDatabase = appDb) {
  await setSetting(chosenKey(kitchenId), sectionId, database);
}

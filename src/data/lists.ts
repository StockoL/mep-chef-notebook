/**
 * Editable lists (DECISIONS 16, F2): the same rename / reorder / merge / hide
 * / add for every list the chef sees. Three kinds of list live in different
 * tables, so a ListRef says which one is meant:
 *   sections  → db.sections   (a kitchen's sections)
 *   services  → db.services   (a kitchen's services)
 *   values    → db.listValues (waste reasons, component types, courses…)
 * The rules themselves are pure and tested in src/core/lists.
 */

import type { Table } from 'dexie';
import { cleanName, moveItem, nameProblem, nextOrder, sortByOrder, type ListItem } from '../core/lists/lists';
import { db as appDb, type MepDatabase } from './db';
import type { Id, KitchenId, ListName } from './types';

export type ListRef =
  | { kind: 'sections'; kitchenId: KitchenId }
  | { kind: 'services'; kitchenId: KitchenId }
  | { kind: 'values'; list: ListName; kitchenId: KitchenId | null };

/** A rule was broken (empty or duplicate name). The message is for the chef. */
export class ListError extends Error {
  override name = 'ListError';
}

/** Every item still on the list (hidden ones too), in order. Merged ones are gone. */
export async function getListItems(ref: ListRef, database: MepDatabase = appDb): Promise<ListItem[]> {
  const rows = await rowsFor(ref, database);
  return sortByOrder(
    rows
      .filter((row) => row.mergedIntoId === null)
      .map((row) => ({ id: row.id, name: nameOf(ref, row), order: row.order, hidden: row.hidden })),
  );
}

export async function addListItem(ref: ListRef, name: string, database: MepDatabase = appDb): Promise<Id> {
  const items = await getListItems(ref, database);
  const problem = nameProblem(name, items);
  if (problem) throw new ListError(problem);
  const base = { order: nextOrder(items), hidden: false, mergedIntoId: null };
  const cleaned = cleanName(name);
  switch (ref.kind) {
    case 'sections':
      return database.sections.add({ ...base, kitchenId: ref.kitchenId, name: cleaned });
    case 'services':
      return database.services.add({ ...base, kitchenId: ref.kitchenId, name: cleaned, iWorkThis: true, windows: [] });
    case 'values':
      return database.listValues.add({ ...base, list: ref.list, kitchenId: ref.kitchenId, value: cleaned });
  }
}

export async function renameListItem(ref: ListRef, id: Id, name: string, database: MepDatabase = appDb) {
  const problem = nameProblem(name, await getListItems(ref, database), id);
  if (problem) throw new ListError(problem);
  const field = ref.kind === 'values' ? 'value' : 'name';
  await tableFor(ref, database).update(id, { [field]: cleanName(name) });
}

/** Hiding keeps history: old notes and entries still show the name. */
export async function setListItemHidden(ref: ListRef, id: Id, hidden: boolean, database: MepDatabase = appDb) {
  if (!hidden) {
    // Showing it again mustn't create a duplicate among visible items.
    const items = await getListItems(ref, database);
    const item = items.find((i) => i.id === id);
    const problem = item && nameProblem(item.name, items, id);
    if (problem) throw new ListError(problem);
  }
  await tableFor(ref, database).update(id, { hidden });
}

export async function moveListItem(ref: ListRef, id: Id, direction: -1 | 1, database: MepDatabase = appDb) {
  const newOrders = moveItem(await getListItems(ref, database), id, direction);
  const table = tableFor(ref, database);
  await database.transaction('rw', table, async () => {
    for (const { id: itemId, order } of newOrders) await table.update(itemId, { order });
  });
}

/**
 * Merges one item into another: everything that pointed at `fromId` now
 * points at `intoId`, and `fromId` leaves the list (kept, marked merged).
 */
export async function mergeListItem(ref: ListRef, fromId: Id, intoId: Id, database: MepDatabase = appDb) {
  if (fromId === intoId) throw new ListError("Choose a different item to merge into.");
  const references = referencesFor(ref, database);
  const tables = [tableFor(ref, database), ...references.map((r) => r.table)];
  await database.transaction('rw', tables, async () => {
    for (const { table, field, isArray } of references) {
      await table.toCollection().modify((row: Record<string, unknown>) => {
        const value = row[field];
        if (isArray && Array.isArray(value) && value.includes(fromId)) {
          row[field] = [...new Set(value.map((v) => (v === fromId ? intoId : v)))];
        } else if (value === fromId) {
          row[field] = intoId;
        }
      });
    }
    await tableFor(ref, database).update(fromId, { mergedIntoId: intoId, hidden: true });
  });
}

// ─── Which table, which field ─────────────────────────────────────────────

interface ListRow {
  id: Id;
  order: number;
  hidden: boolean;
  mergedIntoId: Id | null;
  name?: string;
  value?: string;
}

function tableFor(ref: ListRef, database: MepDatabase): Table<ListRow, Id> {
  const tables = { sections: database.sections, services: database.services, values: database.listValues };
  return tables[ref.kind] as unknown as Table<ListRow, Id>;
}

function nameOf(ref: ListRef, row: ListRow): string {
  return (ref.kind === 'values' ? row.value : row.name) ?? '';
}

async function rowsFor(ref: ListRef, database: MepDatabase): Promise<ListRow[]> {
  if (ref.kind === 'sections') return database.sections.where('kitchenId').equals(ref.kitchenId).toArray();
  if (ref.kind === 'services') return database.services.where('kitchenId').equals(ref.kitchenId).toArray();
  if (ref.kitchenId === null) {
    // The chef's own lists have kitchenId null, which IndexedDB can't index.
    return database.listValues.where('list').equals(ref.list).filter((v) => v.kitchenId === null).toArray();
  }
  return database.listValues.where('[list+kitchenId]').equals([ref.list, ref.kitchenId]).toArray();
}

interface Reference {
  table: Table;
  field: string;
  isArray?: boolean;
}

/** Every field in the data that can point at an item of this list. */
function referencesFor(ref: ListRef, d: MepDatabase): Reference[] {
  if (ref.kind === 'sections') {
    return [
      { table: d.sectionItems, field: 'sectionId' },
      { table: d.checklists, field: 'sectionId' },
      { table: d.notes, field: 'sectionId' },
      { table: d.stockCounts, field: 'sectionId' },
      { table: d.wasteEntries, field: 'sectionId' },
      { table: d.menuSectionAssignments, field: 'sectionId' },
      { table: d.sheets, field: 'sectionIds', isArray: true },
      { table: d.kitchens, field: 'usualSectionId' },
    ];
  }
  if (ref.kind === 'services') {
    return [
      { table: d.events, field: 'replacesServiceId' },
      { table: d.sheetItems, field: 'serviceId' },
    ];
  }
  const byList: Record<ListName, Reference[]> = {
    'waste-reasons': [{ table: d.wasteEntries, field: 'reasonId' }],
    'component-types': [
      { table: d.components, field: 'typeId' },
      { table: d.houseRules, field: 'componentTypeId' },
    ],
    'technique-categories': [{ table: d.techniques, field: 'categoryId' }],
    courses: [{ table: d.menuDishes, field: 'courseId' }],
    'menu-types': [{ table: d.menus, field: 'typeId' }],
    'equipment-types': [
      { table: d.equipment, field: 'typeId' },
      { table: d.steps, field: 'equipmentTypeId' },
      { table: d.wordListEntries, field: 'equipmentTypeId' },
    ],
    tags: [
      { table: d.dishes, field: 'tagIds', isArray: true },
      { table: d.components, field: 'tagIds', isArray: true },
    ],
  };
  return byList[ref.list];
}

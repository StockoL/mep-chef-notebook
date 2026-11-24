/**
 * Starting values for the editable lists (SPEC → Editable lists). These are
 * defaults only: the chef renames, reorders, merges and hides them freely
 * (DECISIONS 16), so nothing in the app may depend on these words.
 */

import type { MepDatabase } from './db';
import type { Id, ListName } from './types';

/** The chef's own lists: travel with the chef, not tied to a kitchen. */
const CHEF_LISTS: Partial<Record<ListName, string[]>> = {
  'component-types': [
    'Stocks and jus',
    'Sauces and emulsions',
    'Pickles and cures',
    'Purées and veloutés',
    'Doughs and batters',
    'Garnishes and crisps',
    'Bases',
  ],
  'technique-categories': ['Knife work', 'Shaping and plating', 'Preserving', 'Sauces', 'Heat'],
  'waste-reasons': ['Out of date', 'Over-prep', 'Dropped', 'Quality', 'Returned'],
};

/** Lists each kitchen gets its own copy of. */
const KITCHEN_LISTS: Partial<Record<ListName, string[]>> = {
  'menu-types': ['À la carte', 'Sunday lunch', 'Breakfast', 'Set', 'Event'],
  courses: ['Nibbles', 'To begin', 'Mains', 'Sides', 'To end'],
  'equipment-types': ['Oven', 'Combi', 'Hob', 'Grill', 'Water bath', 'Blast chiller', 'Fridge', 'Blender', 'Mixer'],
};

const SECTIONS = ['Starters and garnish', 'Fish', 'Meat', 'Veg', 'Pastry', 'Breakfast'];

/** Services a new kitchen starts with; times are set by the chef. */
const SERVICES: { name: string; iWorkThis: boolean }[] = [
  { name: 'Breakfast', iWorkThis: false },
  { name: 'Lunch', iWorkThis: true },
  { name: 'Dinner', iWorkThis: true },
];

/** Adds the starting values to any of the chef's lists that has none at all. */
export async function seedChefLists(database: MepDatabase): Promise<void> {
  for (const [list, values] of Object.entries(CHEF_LISTS) as [ListName, string[]][]) {
    const existing = await database.listValues.where('list').equals(list).filter((v) => v.kitchenId === null).count();
    if (existing > 0) continue;
    await database.listValues.bulkAdd(
      values.map((value, order) => ({ list, kitchenId: null, value, order, hidden: false, mergedIntoId: null })),
    );
  }
}

/** Everything a new kitchen starts with: sections, services and its lists. */
export async function seedKitchen(database: MepDatabase, kitchenId: Id): Promise<void> {
  await database.sections.bulkAdd(
    SECTIONS.map((name, order) => ({ kitchenId, name, order, hidden: false, mergedIntoId: null })),
  );
  await database.services.bulkAdd(
    SERVICES.map(({ name, iWorkThis }, order) => ({
      kitchenId,
      name,
      order,
      hidden: false,
      mergedIntoId: null,
      iWorkThis,
      windows: [],
    })),
  );
  for (const [list, values] of Object.entries(KITCHEN_LISTS) as [ListName, string[]][]) {
    await database.listValues.bulkAdd(
      values.map((value, order) => ({ list, kitchenId, value, order, hidden: false, mergedIntoId: null })),
    );
  }
}

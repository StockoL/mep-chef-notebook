/**
 * Starting values for the editable lists (SPEC → Editable lists). These are
 * defaults only: the chef renames, reorders, merges and hides them freely
 * (DECISIONS 16), so nothing in the app may depend on these words.
 */

import { BUILT_IN_TECHNIQUES, BUILT_IN_TEMPLATES } from '../core/techniques/builtIn';
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
  'equipment-types': ['Oven', 'Combi', 'Hob', 'Grill', 'Water bath', 'Blast chiller', 'Fridge', 'Blender', 'Mixer', 'Bench'],
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

const BENCH_ADDED = 'equipment-bench-added';

/**
 * Phase 4 added "Bench" to the equipment list, for work done by hand (the
 * step reader's default for chopping, passing, resting). Kitchens made before
 * then get it once; if the chef later removes it, it stays removed.
 */
export async function addBenchOnce(database: MepDatabase): Promise<void> {
  await database.transaction('rw', database.settings, database.listValues, database.kitchens, async () => {
    if (await database.settings.get(BENCH_ADDED)) return;
    const values = await database.listValues.where('list').equals('equipment-types').toArray();
    for (const kitchenId of new Set(values.map((v) => v.kitchenId))) {
      const own = values.filter((v) => v.kitchenId === kitchenId);
      if (own.some((v) => v.value.toLowerCase() === 'bench')) continue;
      const order = own.reduce((max, v) => Math.max(max, v.order + 1), 0);
      await database.listValues.add({ list: 'equipment-types', kitchenId, value: 'Bench', order, hidden: false, mergedIntoId: null });
    }
    await database.settings.put({ key: BENCH_ADDED, value: true });
  });
}

/**
 * The built-in "No kitchen" gets an equipment list too, so steps of the
 * chef's own recipes can be read and confirmed before any kitchen is set up.
 * Only if it has none at all.
 */
export async function seedNoKitchenEquipment(database: MepDatabase, noKitchenId: Id): Promise<void> {
  const existing = await database.listValues.where('list').equals('equipment-types').filter((v) => v.kitchenId === noKitchenId).count();
  if (existing > 0) return;
  const values = KITCHEN_LISTS['equipment-types'] ?? [];
  await database.listValues.bulkAdd(
    values.map((value, order) => ({ list: 'equipment-types' as const, kitchenId: noKitchenId, value, order, hidden: false, mergedIntoId: null })),
  );
}

const TECHNIQUES_SEEDED = 'techniques-seeded';

/**
 * Technique names and aliases, and the method templates that go with them
 * (SPEC → Techniques: "the app ships with technique names and aliases only").
 * Added once; whatever the chef then renames or deletes stays that way.
 */
export async function seedTechniquesOnce(database: MepDatabase): Promise<void> {
  await database.transaction('rw', [database.settings, database.techniques, database.methodTemplates, database.listValues], async () => {
    if (await database.settings.get(TECHNIQUES_SEEDED)) return;
    const categories = await database.listValues.where('list').equals('technique-categories').filter((v) => v.kitchenId === null).toArray();
    const ids = new Map<string, Id>();
    for (const technique of BUILT_IN_TECHNIQUES) {
      const categoryId = categories.find((c) => c.value === technique.category)?.id ?? null;
      const id = await database.techniques.add({ name: technique.name, aliases: technique.aliases, categoryId, notes: '', mistakes: '', mediaIds: [] });
      ids.set(technique.name, id);
    }
    for (const template of BUILT_IN_TEMPLATES) {
      const techniqueId = ids.get(template.technique);
      if (techniqueId) await database.methodTemplates.add({ techniqueId, steps: template.steps.map((text) => ({ text, parts: [] })) });
    }
    await database.settings.put({ key: TECHNIQUES_SEEDED, value: true });
  });
}

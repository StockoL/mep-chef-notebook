/**
 * One search box for the whole library (R2, R7): names and aliases of dishes,
 * components, ingredients and techniques, plus the chef's notes, with results
 * grouped by kind. And the recently opened items, for finding things in two taps.
 */

import { nameContains, normalizeName } from '../core/ingredients/names';
import { db as appDb, type MepDatabase } from './db';
import { getSetting, setSetting } from './settings';
import type { Component, Dish, Id, Ingredient, Note, Technique } from './types';

export interface SearchResults {
  dishes: Dish[];
  components: Component[];
  ingredients: Ingredient[];
  techniques: Technique[];
  /** Notes whose text matches: kitchen notes and notes on components. */
  notes: Note[];
}

export async function searchLibrary(query: string, database: MepDatabase = appDb): Promise<SearchResults> {
  const text = normalizeName(query);
  const empty: SearchResults = { dishes: [], components: [], ingredients: [], techniques: [], notes: [] };
  if (!text) return empty;

  const [dishes, components, ingredients, techniques, notes] = await Promise.all([
    database.dishes.toArray(),
    database.components.toArray(),
    database.ingredients.toArray(),
    database.techniques.toArray(),
    database.notes.where('kind').anyOf('kitchen', 'attempt').toArray(),
  ]);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  return {
    dishes: dishes.filter((d) => nameContains({ name: d.name }, text) || normalizeName(d.description).includes(text)).sort(byName),
    components: components.filter((c) => nameContains(c, text)).sort(byName),
    ingredients: ingredients.filter((i) => nameContains(i, text)).sort(byName),
    techniques: techniques.filter((t) => nameContains(t, text)).sort(byName),
    notes: notes.filter((n) => normalizeName(n.body).includes(text)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

// ─── Recent ───────────────────────────────────────────────────────────────

export type LibraryKind = 'dish' | 'component' | 'ingredient';

interface RecentItem {
  kind: LibraryKind;
  id: Id;
}

const RECENT_KEY = 'library.recent';
const MAX_RECENT = 8;

/** Remembers that the chef opened this item (most recent first). */
export async function recordView(item: RecentItem, database: MepDatabase = appDb) {
  const recent = (await getSetting<RecentItem[]>(RECENT_KEY, database)) ?? [];
  const without = recent.filter((r) => !(r.kind === item.kind && r.id === item.id));
  await setSetting(RECENT_KEY, [item, ...without].slice(0, MAX_RECENT), database);
}

/** Recently opened items with their names; deleted ones drop out. */
export async function listRecent(database: MepDatabase = appDb): Promise<(RecentItem & { name: string })[]> {
  const recent = (await getSetting<RecentItem[]>(RECENT_KEY, database)) ?? [];
  const tables = { dish: database.dishes, component: database.components, ingredient: database.ingredients };
  const named = await Promise.all(
    recent.map(async (item) => {
      const row = await tables[item.kind].get(item.id);
      return row ? { ...item, name: row.name } : null;
    }),
  );
  return named.filter((item) => item !== null);
}

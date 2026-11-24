/**
 * The rules every editable list shares (DECISIONS 16, F2): sections,
 * services, waste reasons, component types… Pure functions; the data layer
 * (src/data/lists.ts) applies them to whichever table holds the list.
 */

export interface ListItem {
  id: string;
  name: string;
  order: number;
  hidden: boolean;
}

/** Tidies a typed name: trims and squashes repeated spaces. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Why a name can't be used, or null if it can. Names must not be empty and
 * must not match another visible item (ignoring case), so "Fish" and "fish"
 * can't both appear. `exceptId` is the item being renamed.
 */
export function nameProblem(name: string, items: ListItem[], exceptId?: string): string | null {
  const cleaned = cleanName(name);
  if (!cleaned) return 'Give it a name.';
  const clash = items.find(
    (item) => item.id !== exceptId && !item.hidden && item.name.toLowerCase() === cleaned.toLowerCase(),
  );
  return clash ? `"${clash.name}" is already on the list.` : null;
}

/** The items in display order. */
export function sortByOrder<T extends { order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * Moves one item up or down the list and returns the new order number for
 * every item, as { id, order } pairs (0, 1, 2…). Out-of-range moves stop at
 * the ends.
 */
export function moveItem(items: readonly ListItem[], id: string, direction: -1 | 1): { id: string; order: number }[] {
  const sorted = sortByOrder(items);
  const from = sorted.findIndex((item) => item.id === id);
  if (from === -1) throw new Error(`No item ${id} in the list`);
  const to = Math.min(Math.max(from + direction, 0), sorted.length - 1);
  const [moved] = sorted.splice(from, 1);
  sorted.splice(to, 0, moved!);
  return sorted.map((item, index) => ({ id: item.id, order: index }));
}

/** The order number for a new item: after everything else. */
export function nextOrder(items: readonly { order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.order + 1), 0);
}

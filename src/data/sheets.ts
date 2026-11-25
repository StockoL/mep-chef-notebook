/**
 * The shift sheet (SPEC → The shift sheet, SH1–SH3): today's list of prep
 * and top-ups for the sections the chef is on, ticked off through the shift,
 * and tomorrow's, written at the end of it with unfinished items carried over.
 *
 * One sheet per kitchen, date and set of sections. "Today" is the calendar
 * date (DECISIONS 36).
 */

import { findByName } from '../core/ingredients/names';
import { parseItem } from '../core/ingredients/shorthand';
import { formatSheetText, sortSheetItems } from '../core/sheet/sheet';
import { formatQuantity } from '../core/units/units';
import { db as appDb, type MepDatabase } from './db';
import { nowTimestamp } from './ids';
import { getVariationInUse } from './library';
import { listSectionItems } from './sectionItems';
import { belowParComponents } from './stock';
import type { CalendarDate, Id, KitchenId, Quantity, Sheet, SheetItem, SheetItemSource } from './types';

export function getSheet(id: Id, database: MepDatabase = appDb) {
  return database.sheets.get(id);
}

/** The sheet for these sections on this date, if there is one. */
export async function findSheet(
  kitchenId: KitchenId,
  date: CalendarDate,
  sectionIds: Id[],
  database: MepDatabase = appDb,
): Promise<Sheet | undefined> {
  const sheets = await database.sheets.where('[kitchenId+date]').equals([kitchenId, date]).toArray();
  const key = [...sectionIds].sort().join('|');
  // The same sections exactly. With none given (the kitchen's sheet for the
  // day, DECISIONS 48), any sheet that day: older ones were started per section.
  return (
    sheets.find((s) => [...s.sectionIds].sort().join('|') === key) ??
    (sectionIds.length === 0 ? sheets[0] : sectionIds[0] ? sheets.find((s) => s.sectionIds.includes(sectionIds[0]!)) : undefined)
  );
}

export async function getOrCreateSheet(
  kitchenId: KitchenId,
  date: CalendarDate,
  sectionIds: Id[],
  database: MepDatabase = appDb,
): Promise<Id> {
  const existing = await findSheet(kitchenId, date, sectionIds, database);
  if (existing) return existing.id;
  return database.sheets.add({ kitchenId, sectionIds, date, covers: null, writtenAt: null, photoId: null });
}

// ─── Reading a sheet ──────────────────────────────────────────────────────

export interface SheetItemView {
  item: SheetItem;
  /** "Beurre blanc" */
  name: string;
  /** "2l", "top up to 500ml", or "" */
  amount: string;
  serviceName: string | null;
  /** The component behind it, if any: for opening its recipe. */
  componentId: Id | null;
  /** Its recipe is still a draft: shown with a marker (SH1). */
  isDraft: boolean;
}

export interface SheetView {
  sheet: Sheet;
  items: SheetItemView[];
}

/** A sheet with its items named and in display order (ticked ones last). */
export async function getSheetView(sheetId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<SheetView | undefined> {
  const sheet = await database.sheets.get(sheetId);
  if (!sheet) return undefined;
  const items = sortSheetItems(await database.sheetItems.where('sheetId').equals(sheetId).toArray());
  const services = new Map((await database.services.where('kitchenId').equals(kitchenId).toArray()).map((s) => [s.id, s.name]));

  const views = await Promise.all(
    items.map(async (item): Promise<SheetItemView> => {
      let name = item.text ?? '';
      let componentId = item.componentId;
      if (item.sectionItemId) {
        const sectionItem = await database.sectionItems.get(item.sectionItemId);
        componentId = sectionItem?.componentId ?? componentId;
        if (sectionItem?.ingredientId) name = (await database.ingredients.get(sectionItem.ingredientId))?.name ?? name;
      }
      if (componentId) name = (await database.components.get(componentId))?.name ?? name;
      const variation = componentId ? await getVariationInUse(componentId, kitchenId, database) : undefined;
      return {
        item,
        name: name || 'Item',
        amount: amountText(item),
        serviceName: item.serviceId ? (services.get(item.serviceId) ?? null) : null,
        componentId,
        isDraft: variation?.status === 'draft',
      };
    }),
  );
  return { sheet, items: views };
}

function amountText(item: SheetItem): string {
  if (item.topUpTo) return `top up to ${formatQuantity(item.topUpTo.amount, item.topUpTo.unit)}`;
  if (item.quantity) return formatQuantity(item.quantity.amount, item.quantity.unit);
  return '';
}

// ─── Changing a sheet ─────────────────────────────────────────────────────

export interface SheetItemInput {
  componentId?: Id | null;
  sectionItemId?: Id | null;
  text?: string | null;
  quantity?: Quantity | null;
  topUpTo?: Quantity | null;
  serviceId?: Id | null;
  source: SheetItemSource;
}

/** Adds items to the end of a sheet, in the order given. Returns their ids. */
export async function addSheetItems(sheetId: Id, inputs: SheetItemInput[], database: MepDatabase = appDb): Promise<Id[]> {
  return database.transaction('rw', database.sheetItems, async () => {
    const existing = await database.sheetItems.where('sheetId').equals(sheetId).toArray();
    let order = existing.reduce((max, i) => Math.max(max, i.order + 1), 0);
    const ids: Id[] = [];
    for (const input of inputs) {
      ids.push(
        await database.sheetItems.add({
          sheetId,
          componentId: input.componentId ?? null,
          sectionItemId: input.sectionItemId ?? null,
          text: input.text ?? null,
          quantity: input.quantity ?? null,
          topUpTo: input.topUpTo ?? null,
          serviceId: input.serviceId ?? null,
          done: false,
          order: order++,
          source: input.source,
        }),
      );
    }
    return ids;
  });
}

export async function updateSheetItem(
  id: Id,
  changes: Partial<Pick<SheetItem, 'quantity' | 'topUpTo' | 'serviceId' | 'text'>>,
  database: MepDatabase = appDb,
) {
  await database.sheetItems.update(id, changes);
}

/** Tick or untick (SH1). */
export async function setItemDone(id: Id, done: boolean, database: MepDatabase = appDb) {
  await database.sheetItems.update(id, { done });
}

export async function deleteSheetItem(id: Id, database: MepDatabase = appDb) {
  const item = await database.sheetItems.get(id);
  await database.sheetItems.delete(id);
  return item;
}

export async function setSheetCovers(sheetId: Id, covers: number | null, database: MepDatabase = appDb) {
  await database.sheets.update(sheetId, { covers });
}

/** Keeps the photo of chef's paper sheet with the sheet (DECISIONS 35). */
export async function setSheetPhoto(sheetId: Id, photo: Blob, database: MepDatabase = appDb) {
  await database.transaction('rw', database.sheets, database.media, async () => {
    const sheet = await database.sheets.get(sheetId);
    if (sheet?.photoId) await database.media.delete(sheet.photoId);
    const photoId = await database.media.add({ blob: photo, type: photo.type || 'image/jpeg' });
    await database.sheets.update(sheetId, { photoId });
  });
}

/**
 * Reads one typed line from chef's paper sheet ("beurre blanc 2l") into an
 * item: a component by name, then something on a section list, else
 * kept as typed text.
 */
export async function readTypedItem(text: string, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<SheetItemInput | null> {
  const line = parseItem(text);
  if (!line.name) return null;
  const quantity = line.quantity !== null && line.unit ? { amount: line.quantity, unit: line.unit } : null;
  // Every section's list in the kitchen: the sheet isn't tied to one section.
  const sectionIds = (await database.sections.where('kitchenId').equals(kitchenId).toArray()).map((s) => s.id);
  const sectionItems = (await Promise.all(sectionIds.map((id) => listSectionItems(id, database)))).flat();
  const onList = findByName(
    sectionItems.map((s) => ({ ...s, aliases: [] as string[] })),
    line.name,
  );
  if (onList) return { sectionItemId: onList.item.id, quantity, source: 'paper' };
  const component = findByName(await database.components.toArray(), line.name);
  if (component) return { componentId: component.id, quantity, source: 'paper' };
  return { text: line.name.charAt(0).toUpperCase() + line.name.slice(1), quantity, source: 'paper' };
}

// ─── The next shift ───────────────────────────────────────────────────────

/**
 * Writes the next shift's sheet (SH3): the same sections on `date`, with
 * today's unfinished items carried over (once; running it again adds no
 * duplicates). Returns the new sheet's id.
 */
export async function writeNextSheet(fromSheetId: Id, date: CalendarDate, database: MepDatabase = appDb): Promise<Id> {
  return (await writeNextSheetWithSummary(fromSheetId, date, database)).id;
}

/**
 * Writes the next shift's sheet (SH3) and says what went on it: today's
 * unfinished items carried over, and (from Phase 11) components short of par
 * at the latest count, to top up (A2). Running it again adds nothing twice.
 */
export async function writeNextSheetWithSummary(
  fromSheetId: Id,
  date: CalendarDate,
  database: MepDatabase = appDb,
): Promise<{ id: Id; carried: number; toppedUp: number }> {
  const from = await database.sheets.get(fromSheetId);
  if (!from) throw new Error('That sheet no longer exists.');
  const nextId = await getOrCreateSheet(from.kitchenId, date, from.sectionIds, database);
  const unfinished = sortSheetItems(await database.sheetItems.where('sheetId').equals(fromSheetId).toArray()).filter((i) => !i.done);
  const already = await database.sheetItems.where('sheetId').equals(nextId).toArray();
  const sameThing = (a: SheetItem, b: SheetItem) =>
    a.componentId === b.componentId && a.sectionItemId === b.sectionItemId && a.text === b.text;
  const toCarry = unfinished.filter((item) => !already.some((a) => sameThing(a, item)));
  await addSheetItems(
    nextId,
    toCarry.map((i) => ({ ...i, source: 'carried-over' as const })),
    database,
  );

  // Below par at the latest count: top up to par, unless it's on already.
  const onNext = [...already, ...toCarry];
  const sectionItems = new Map((await database.sectionItems.toArray()).map((s) => [s.id, s]));
  const listed = (sectionItemId: Id) => {
    const componentId = sectionItems.get(sectionItemId)?.componentId;
    return onNext.some((i) => i.sectionItemId === sectionItemId || (componentId && i.componentId === componentId));
  };
  const toTopUp = (await belowParComponents(from.kitchenId, database)).filter((b) => !listed(b.sectionItemId));
  await addSheetItems(
    nextId,
    toTopUp.map((b) => ({ sectionItemId: b.sectionItemId, topUpTo: b.par, source: 'section-list' as const })),
    database,
  );
  await database.sheets.update(nextId, { writtenAt: nowTimestamp() });
  return { id: nextId, carried: toCarry.length, toppedUp: toTopUp.length };
}

/** The sheet as text to share (SH3). */
export async function sheetText(sheetId: Id, kitchenId: KitchenId, heading: string, database: MepDatabase = appDb): Promise<string> {
  const view = await getSheetView(sheetId, kitchenId, database);
  if (!view) return heading;
  return formatSheetText(
    heading,
    view.items.map((v) => ({
      label: [v.name, v.amount].filter(Boolean).join(' ') + (v.isDraft ? ' (draft)' : ''),
      done: v.item.done,
      service: v.serviceName,
    })),
  );
}

/** Recent sheets for a kitchen, newest first: for finding yesterday's after midnight. */
export async function listSheets(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Sheet[]> {
  return (await database.sheets.where('[kitchenId+date]').between([kitchenId, ''], [kitchenId, '￿']).toArray()).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

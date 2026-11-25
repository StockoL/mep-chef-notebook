import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MepDatabase } from './db';
import { createEvent, deleteEvent, setTimeChange } from './events';
import { importData } from './importData';
import { createKitchen, getNextService, getPlace, listSections, listServices, placeSectionIds, setAlsoCovering, setPlace, updateService } from './kitchens';
import { createComponent, getVariationInUse } from './library';
import { addSectionItem, listSectionItems, removeSectionItem } from './sectionItems';
import {
  addSheetItems,
  findSheet,
  getOrCreateSheet,
  getSheetView,
  readTypedItem,
  setItemDone,
  sheetText,
  writeNextSheet,
} from './sheets';
import { restoreSnapshot } from './snapshot';
import { freshDatabase } from './testing';

let db: MepDatabase;
let kitchenId: string;
let fish: string;
let starters: string;

beforeEach(async () => {
  db = await freshDatabase();
  kitchenId = await createKitchen('Dumbleton Hall', db);
  const sections = await listSections(kitchenId, db);
  starters = sections.find((s) => s.name === 'Starters and garnish')!.id;
  fish = sections.find((s) => s.name === 'Fish')!.id;
});
afterEach(async () => {
  await db.delete();
});

describe('which sheet', () => {
  it('reuses the sheet for the same sections and date', async () => {
    const a = await getOrCreateSheet(kitchenId, '2026-11-25', [fish], db);
    expect(await getOrCreateSheet(kitchenId, '2026-11-25', [fish], db)).toBe(a);
    expect(await getOrCreateSheet(kitchenId, '2026-11-26', [fish], db)).not.toBe(a);
  });

  it('covering two sections shares one sheet (MS3)', async () => {
    await setPlace(kitchenId, fish, db);
    await setAlsoCovering(starters, db);
    const place = await getPlace(db);
    expect(placeSectionIds(place)).toEqual([fish, starters]);
    const shared = await getOrCreateSheet(kitchenId, '2026-11-25', placeSectionIds(place), db);
    expect((await db.sheets.get(shared))?.sectionIds).toEqual([fish, starters]);
    // Switching section ends covering.
    await setPlace(kitchenId, starters, db);
    expect((await getPlace(db)).alsoSectionId).toBeNull();
  });
});

describe('sheet items', () => {
  it('shows names, amounts, services and a draft marker', async () => {
    const componentId = await createComponent('Beurre blanc', kitchenId, db);
    const [lunch] = await listServices(kitchenId, db).then((s) => s.filter((x) => x.name === 'Lunch'));
    const sheetId = await getOrCreateSheet(kitchenId, '2026-11-25', [fish], db);
    await addSheetItems(sheetId, [
      { componentId, quantity: { amount: 2, unit: 'l' }, serviceId: lunch!.id, source: 'manual' },
      { text: 'Chive oil', topUpTo: { amount: 500, unit: 'ml' }, source: 'manual' },
    ], db);
    const view = await getSheetView(sheetId, kitchenId, db);
    expect(view?.items.map((v) => [v.name, v.amount, v.serviceName, v.isDraft])).toEqual([
      ['Beurre blanc', '2l', 'Lunch', true],
      ['Chive oil', 'top up to 500ml', null, false],
    ]);
  });

  it('settles ticked items to the bottom', async () => {
    const sheetId = await getOrCreateSheet(kitchenId, '2026-11-25', [fish], db);
    const [a] = await addSheetItems(sheetId, [{ text: 'A', source: 'manual' }, { text: 'B', source: 'manual' }], db);
    await setItemDone(a!, true, db);
    expect((await getSheetView(sheetId, kitchenId, db))?.items.map((v) => v.name)).toEqual(['B', 'A']);
  });

  it('reads a typed line from chef’s paper sheet', async () => {
    const componentId = await createComponent('Beurre blanc', kitchenId, db);
    const chives = (await db.ingredients.add({ name: 'Chives', aliases: [], kind: 'basic', allergens: [], density: null, yieldLossPercent: null }));
    const sectionItemId = await addSectionItem(fish, { ingredientId: chives }, db);
    expect(await readTypedItem('beurre blanc 2l', [fish], db)).toEqual({ componentId, quantity: { amount: 2, unit: 'l' }, source: 'paper' });
    expect(await readTypedItem('chives 2 bunches', [fish], db)).toEqual({ sectionItemId, quantity: { amount: 2, unit: 'bunch' }, source: 'paper' });
    expect(await readTypedItem('pick cress', [fish], db)).toEqual({ text: 'Pick cress', quantity: null, source: 'paper' });
  });
});

describe('the next shift (SH3)', () => {
  it('carries unfinished items over, once', async () => {
    const today = await getOrCreateSheet(kitchenId, '2026-11-25', [fish], db);
    const [done] = await addSheetItems(today, [{ text: 'Done already', source: 'manual' }, { text: 'Still to do', source: 'manual' }], db);
    await setItemDone(done!, true, db);
    const next = await writeNextSheet(today, '2026-11-26', db);
    await writeNextSheet(today, '2026-11-26', db); // again: no duplicates
    const view = await getSheetView(next, kitchenId, db);
    expect(view?.items.map((v) => [v.name, v.item.source, v.item.done])).toEqual([['Still to do', 'carried-over', false]]);
    expect(view?.sheet.writtenAt).toBeTruthy();
    expect((await findSheet(kitchenId, '2026-11-26', [fish], db))?.id).toBe(next);
  });

  it('shares as text grouped by service', async () => {
    const sheetId = await getOrCreateSheet(kitchenId, '2026-11-25', [fish], db);
    const lunch = (await listServices(kitchenId, db)).find((s) => s.name === 'Lunch')!;
    await addSheetItems(sheetId, [
      { text: 'Trout portions', quantity: { amount: 12, unit: 'each' }, serviceId: lunch.id, source: 'manual' },
      { text: 'Pickle shallots', source: 'manual' },
    ], db);
    expect(await sheetText(sheetId, kitchenId, 'Fish · Wed 25 Nov', db)).toBe(
      'Fish · Wed 25 Nov\n☐ Pickle shallots\n\nLunch\n☐ Trout portions 12',
    );
  });
});

describe('events and time changes (K6)', () => {
  it('a one-off time change moves the next service, and can be undone', async () => {
    const dinner = (await listServices(kitchenId, db)).find((s) => s.name === 'Dinner')!;
    await updateService(dinner.id, { windows: [{ days: [1, 2, 3, 4, 5, 6, 7], firstTickets: '18:00', lastBookings: '20:15', usualFinish: null }] }, db);
    const lunch = (await listServices(kitchenId, db)).find((s) => s.name === 'Lunch')!;
    await updateService(lunch.id, { iWorkThis: false }, db);
    const wednesday5pm = new Date(2026, 10, 25, 17, 0);
    expect((await getNextService(kitchenId, wednesday5pm, db))?.firstTickets).toBe('18:00');
    await setTimeChange(kitchenId, '2026-11-25', dinner, '19:00', '21:00', db);
    expect(await getNextService(kitchenId, wednesday5pm, db)).toMatchObject({ name: 'Dinner', firstTickets: '19:00', fromEvent: true });
    await setTimeChange(kitchenId, '2026-11-25', dinner, null, null, db);
    expect((await getNextService(kitchenId, wednesday5pm, db))?.firstTickets).toBe('18:00');
  });

  it('deletes an event with Undo', async () => {
    const id = await createEvent(kitchenId, '2026-12-05', 'Smith wedding', db);
    const snapshot = await deleteEvent(id, db);
    expect(await db.events.count()).toBe(0);
    await restoreSnapshot(snapshot, db);
    expect((await db.events.get(id))?.name).toBe('Smith wedding');
  });
});

describe('section lists', () => {
  it('adds each item once and removes with Undo', async () => {
    const componentId = await createComponent('Beurre blanc', kitchenId, db);
    const id = await addSectionItem(fish, { componentId }, db);
    expect(await addSectionItem(fish, { componentId }, db)).toBe(id);
    expect((await listSectionItems(fish, db)).map((s) => s.name)).toEqual(['Beurre blanc']);
    const removed = await removeSectionItem(id, db);
    expect(await listSectionItems(fish, db)).toEqual([]);
    await restoreSnapshot({ sectionItems: [removed!] }, db);
    expect(await listSectionItems(fish, db)).toHaveLength(1);
    expect(await getVariationInUse(componentId, kitchenId, db)).toBeDefined();
  });
});

describe('schema v3', () => {
  it('gives sheets from an older export a photoId', async () => {
    const file = {
      format: 'mep-export',
      formatVersion: 1,
      schemaVersion: 2,
      tables: { sheets: [{ id: 's1', kitchenId: 'none', sectionIds: [], date: '2026-11-24', covers: null, writtenAt: null, createdAt: 't', updatedAt: 't' }] },
    };
    await importData(zipSync({ 'data.json': strToU8(JSON.stringify(file)) }), db);
    expect(await db.sheets.get('s1')).toMatchObject({ photoId: null });
  });
});

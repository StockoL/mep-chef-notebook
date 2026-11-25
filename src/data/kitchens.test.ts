import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MepDatabase } from './db';
import { createKitchen, getPlace, listKitchens, listSections, listServices, renameKitchen, setKitchenArchived, setPlace, setUsualSection } from './kitchens';
import { addListItem, getListItems, ListError, mergeListItem, moveListItem, renameListItem, setListItemHidden } from './lists';
import { freshDatabase } from './testing';
import { NO_KITCHEN_ID } from './types';

let db: MepDatabase;
beforeEach(async () => {
  db = await freshDatabase();
});
afterEach(async () => {
  await db.delete();
});

describe('kitchens', () => {
  it('starts with only "No kitchen", which can’t be renamed or archived', async () => {
    expect((await listKitchens(db)).map((k) => k.name)).toEqual(['No kitchen']);
    await expect(renameKitchen(NO_KITCHEN_ID, 'Home', db)).rejects.toThrow(ListError);
    await expect(setKitchenArchived(NO_KITCHEN_ID, true, db)).rejects.toThrow(ListError);
  });

  it('gives a new kitchen its starting sections, services and lists', async () => {
    const id = await createKitchen('  Dumbleton Hall ', db);
    expect((await db.kitchens.get(id))?.name).toBe('Dumbleton Hall');
    expect((await listSections(id, db)).map((s) => s.name)).toEqual([
      'Starters and garnish', 'Fish', 'Meat', 'Veg', 'Pastry', 'Breakfast',
    ]);
    expect((await listServices(id, db)).map((s) => [s.name, s.iWorkThis])).toEqual([
      ['Breakfast', false], ['Lunch', true], ['Dinner', true],
    ]);
    expect(await getListItems({ kind: 'values', list: 'courses', kitchenId: id }, db)).toHaveLength(5);
  });

  it('seeds the chef’s own lists once', async () => {
    const reasons = await getListItems({ kind: 'values', list: 'waste-reasons', kitchenId: null }, db);
    expect(reasons.map((r) => r.name)).toEqual(['Out of date', 'Over-prep', 'Dropped', 'Quality', 'Returned']);
  });
});

describe('where the chef is', () => {
  it('defaults to No kitchen', async () => {
    expect(await getPlace(db)).toEqual({ kitchenId: NO_KITCHEN_ID, sectionId: null });
  });

  it('switching kitchen picks the usual section there', async () => {
    const id = await createKitchen('Dumbleton Hall', db);
    const [starters] = await listSections(id, db);
    await setUsualSection(id, starters!.id, db);
    await setPlace(id, undefined, db);
    expect(await getPlace(db)).toEqual({ kitchenId: id, sectionId: starters!.id, alsoSectionId: null });
  });

  it('falls back to No kitchen when the current one is archived', async () => {
    const id = await createKitchen('Old job', db);
    await setPlace(id, null, db);
    await setKitchenArchived(id, true, db);
    expect((await getPlace(db)).kitchenId).toBe(NO_KITCHEN_ID);
  });
});

describe('editable lists', () => {
  it('adds, renames, reorders and hides, refusing duplicates', async () => {
    const ref = { kind: 'values', list: 'waste-reasons', kitchenId: null } as const;
    const id = await addListItem(ref, 'Burnt', db);
    await expect(addListItem(ref, 'burnt', db)).rejects.toThrow(/already/);
    await renameListItem(ref, id, 'Burnt on the stove', db);
    await moveListItem(ref, id, -1, db);
    let names = (await getListItems(ref, db)).map((i) => i.name);
    expect(names.at(-2)).toBe('Burnt on the stove');
    await setListItemHidden(ref, id, true, db);
    expect((await getListItems(ref, db)).find((i) => i.id === id)?.hidden).toBe(true);
    names = (await getListItems(ref, db)).map((i) => i.name);
    expect(names).toContain('Burnt on the stove'); // hidden, still listed for the editor
  });

  it('merging moves everything to the kept section and leaves the list', async () => {
    const kitchenId = await createKitchen('Dumbleton Hall', db);
    const ref = { kind: 'sections', kitchenId } as const;
    const [starters, fish] = await getListItems(ref, db);
    await setUsualSection(kitchenId, fish!.id, db);
    const noteId = await db.notes.add({ kind: 'inbox', body: 'x', mediaIds: [], kitchenId, sectionId: fish!.id, links: [] });
    const sheetId = await db.sheets.add({ kitchenId, sectionIds: [fish!.id, starters!.id], date: '2026-11-24', covers: null, writtenAt: null, photoId: null });

    await mergeListItem(ref, fish!.id, starters!.id, db);

    expect((await db.notes.get(noteId))?.sectionId).toBe(starters!.id);
    expect((await db.sheets.get(sheetId))?.sectionIds).toEqual([starters!.id]);
    expect((await db.kitchens.get(kitchenId))?.usualSectionId).toBe(starters!.id);
    expect((await getListItems(ref, db)).map((s) => s.name)).not.toContain('Fish');
  });
});

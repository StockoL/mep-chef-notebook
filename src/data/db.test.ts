// fake-indexeddb puts an in-memory IndexedDB on globalThis, so Dexie can run in Node.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureBuiltIns, MepDatabase, TABLE_NAMES } from './db';
import { newId } from './ids';
import { NO_KITCHEN_ID } from './types';

let db: MepDatabase;

beforeEach(async () => {
  // A fresh, uniquely named database for every test.
  db = new MepDatabase(`test-${newId()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('schema', () => {
  it('has a table for every entity in SPEC → Data model, plus media and settings', () => {
    const expected = [
      'kitchens', 'sections', 'sectionItems', 'checklists', 'services', 'shiftPatterns',
      'events', 'eventServices', 'equipment', 'suppliers', 'houseRules', 'menus',
      'menuDishes', 'menuSectionAssignments', 'dishes', 'dishComponents', 'components',
      'variations', 'versions', 'lines', 'steps', 'ingredients', 'products', 'techniques',
      'techniqueVariants', 'techniqueKitchenNotes', 'methodTemplates', 'notes', 'sheets',
      'sheetItems', 'timings', 'batches', 'stockCounts', 'orderDrafts', 'wasteEntries',
      'weeklyGoals', 'collections', 'listValues', 'wordListEntries', 'media', 'settings',
    ];
    expect([...TABLE_NAMES].sort()).toEqual([...expected].sort());
    expect(db.tables.map((table) => table.name).sort()).toEqual([...expected].sort());
    expect(db.verno).toBe(5);
  });

  it('stores and reads back a row in every table', async () => {
    for (const name of TABLE_NAMES) {
      const table = db.table(name);
      if (name === 'settings') {
        await table.add({ key: 'check', value: 1 });
        expect(await table.get('check')).toEqual({ key: 'check', value: 1 });
        continue;
      }
      const id = await table.add({ marker: name });
      const row = await table.get(id);
      expect(row, name).toMatchObject({ id, marker: name });
    }
  });
});

describe('row hooks', () => {
  it('fills in id, createdAt and updatedAt on create', async () => {
    const id = await db.notes.add({
      kind: 'inbox',
      body: 'Less salt in the beurre blanc',
      mediaIds: [],
      kitchenId: NO_KITCHEN_ID,
      sectionId: null,
      links: [],
    });
    const note = await db.notes.get(id);
    expect(note?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(note?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(note?.updatedAt).toBe(note?.createdAt);
  });

  it('keeps ids and timestamps that are given (import relies on this)', async () => {
    const given = { id: 'abc', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' };
    await db.collections.add({ ...given, name: 'Christmas ideas', members: [] });
    expect(await db.collections.get('abc')).toMatchObject(given);
  });

  it('moves updatedAt on update and leaves createdAt alone', async () => {
    const old = '2026-01-01T00:00:00.000Z';
    await db.collections.add({ id: 'c1', createdAt: old, updatedAt: old, name: 'Things to master', members: [] });
    await db.collections.update('c1', { name: 'Things to master first' });
    const row = await db.collections.get('c1');
    expect(row?.createdAt).toBe(old);
    expect(row?.updatedAt).not.toBe(old);
  });

  it('stores media as a Blob and gives it back', async () => {
    const blob = new Blob(['not really a photo'], { type: 'image/jpeg' });
    const id = await db.media.add({ blob, type: 'image/jpeg' });
    const media = await db.media.get(id);
    expect(media?.blob).toBeInstanceOf(Blob);
    expect(await media?.blob.text()).toBe('not really a photo');
  });
});

describe('ensureBuiltIns', () => {
  it('creates the "No kitchen" record once, however often it runs', async () => {
    await ensureBuiltIns(db);
    await ensureBuiltIns(db);
    const kitchens = await db.kitchens.toArray();
    expect(kitchens).toHaveLength(1);
    expect(kitchens[0]).toMatchObject({ id: NO_KITCHEN_ID, name: 'No kitchen', builtIn: true });
  });

  it('lets "none" be found by a compound index, which null could not', async () => {
    await db.sheets.add({ kitchenId: NO_KITCHEN_ID, sectionIds: [], date: '2026-11-24', covers: null, writtenAt: null, photoId: null });
    const found = await db.sheets.where('[kitchenId+date]').equals([NO_KITCHEN_ID, '2026-11-24']).toArray();
    expect(found).toHaveLength(1);
  });
});

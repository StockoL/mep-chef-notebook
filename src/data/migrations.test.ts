import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { MepDatabase, SCHEMA_V1 } from './db';
import { newId } from './ids';
import { importData } from './importData';

const names: string[] = [];
afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)));
});

describe('upgrading a version 1 database already on the phone', () => {
  it('fills in the new fields and keeps everything else', async () => {
    const name = `v1-${newId()}`;
    names.push(name);

    // A database exactly as Phase 0 left it.
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.open();
    await v1.table('kitchens').add({ id: 'none', name: 'No kitchen', archived: false, sheetName: "Today's sheet", builtIn: true, createdAt: 't', updatedAt: 't' });
    await v1.table('settings').put({ key: 'storage.marker', value: '2026-11-24T18:00:00.000Z' });
    await v1.table('services').add({ id: 's1', kitchenId: 'k', name: 'Lunch', firstTickets: '12:00', lastBookings: '16:30', usualFinish: null, days: [1, 2], iWorkThis: true, createdAt: 't', updatedAt: 't' });
    v1.close();

    const upgraded = new MepDatabase(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(3);
    expect(await upgraded.kitchens.get('none')).toMatchObject({ name: 'No kitchen', usualSectionId: null });
    expect(await upgraded.settings.get('storage.marker')).toEqual({ key: 'storage.marker', value: '2026-11-24T18:00:00.000Z' });
    expect(await upgraded.services.get('s1')).toMatchObject({
      name: 'Lunch',
      order: 0,
      hidden: false,
      mergedIntoId: null,
      windows: [{ days: [1, 2], firstTickets: '12:00', lastBookings: '16:30', usualFinish: null }],
    });
    expect(await upgraded.services.get('s1')).not.toHaveProperty('firstTickets');
    upgraded.close();
  });
});

describe('importing a version 1 export', () => {
  it('upgrades its rows the same way', async () => {
    const name = `import-${newId()}`;
    names.push(name);
    const database = new MepDatabase(name);
    await database.open();

    const file = {
      format: 'mep-export',
      formatVersion: 1,
      schemaVersion: 1,
      tables: { kitchens: [{ id: 'none', name: 'No kitchen', archived: false, sheetName: "Today's sheet", builtIn: true, createdAt: 't', updatedAt: 't' }] },
    };
    await importData(zipSync({ 'data.json': strToU8(JSON.stringify(file)) }), database);
    expect(await database.kitchens.get('none')).toMatchObject({ usualSectionId: null });
    database.close();
  });
});

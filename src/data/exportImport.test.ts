import 'fake-indexeddb/auto';
import { strToU8, unzipSync, zipSync, strFromU8 } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureBuiltIns, MepDatabase, TABLE_NAMES } from './db';
import { exportData } from './exportData';
import { exportFileName } from './exportFormat';
import { newId } from './ids';
import { importData, ImportError } from './importData';
import { NO_KITCHEN_ID } from './types';

let source: MepDatabase;
let target: MepDatabase;

beforeEach(async () => {
  source = new MepDatabase(`source-${newId()}`);
  target = new MepDatabase(`target-${newId()}`);
  await Promise.all([source.open(), target.open()]);
});

afterEach(async () => {
  await Promise.all([source.delete(), target.delete()]);
});

/** Every table's rows, sorted by key, with each Blob swapped for its text. */
async function snapshot(database: MepDatabase) {
  const result: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    const rows = await database.table(name).toArray();
    const keyField = name === 'settings' ? 'key' : 'id';
    rows.sort((a, b) => String(a[keyField]).localeCompare(String(b[keyField])));
    result[name] = await Promise.all(
      rows.map(async (row) => (row.blob instanceof Blob ? { ...row, blob: await row.blob.text() } : row)),
    );
  }
  return result;
}

describe('export → import', () => {
  it('round-trips an empty database (with its built-in No kitchen)', async () => {
    await ensureBuiltIns(source);
    await importData(await exportData(source), target);
    expect(await snapshot(target)).toEqual(await snapshot(source));
  });

  it('round-trips rows, ids, timestamps, settings and media without loss', async () => {
    await ensureBuiltIns(source);
    const photoId = await source.media.add({
      blob: new Blob(['jpeg bytes'], { type: 'image/jpeg' }),
      type: 'image/jpeg',
    });
    const voiceId = await source.media.add({
      blob: new Blob(['audio bytes'], { type: 'audio/mp4' }),
      type: 'audio/mp4',
    });
    await source.notes.add({
      kind: 'inbox',
      body: 'Chef: quenelles three-sided here',
      mediaIds: [photoId, voiceId],
      kitchenId: NO_KITCHEN_ID,
      sectionId: null,
      links: [],
    });
    await source.listValues.add({
      list: 'waste-reasons',
      kitchenId: null,
      value: 'Over-prep',
      order: 1,
      hidden: false,
      mergedIntoId: null,
    });
    await source.settings.put({ key: 'theme', value: 'dark' });

    await importData(await exportData(source), target);
    expect(await snapshot(target)).toEqual(await snapshot(source));
  });

  it('writes media as files beside data.json, not inside it', async () => {
    const id = await source.media.add({ blob: new Blob(['x'], { type: 'image/png' }), type: 'image/png' });
    const files = unzipSync(await exportData(source));
    expect(Object.keys(files).sort()).toEqual(['data.json', `media/${id}.png`]);
    const data = JSON.parse(strFromU8(files['data.json']!));
    expect(data).toMatchObject({ format: 'mep-export', formatVersion: 1, schemaVersion: 1 });
    expect(data.tables.media[0]).toEqual(expect.objectContaining({ id, file: `media/${id}.png` }));
    expect(data.tables.media[0]).not.toHaveProperty('blob');
  });

  it('replaces what was there before', async () => {
    await target.notes.add({ kind: 'inbox', body: 'old', mediaIds: [], kitchenId: NO_KITCHEN_ID, sectionId: null, links: [] });
    await importData(await exportData(source), target);
    expect(await target.notes.count()).toBe(0);
    expect(await target.kitchens.get(NO_KITCHEN_ID)).toBeDefined(); // built-ins restored
  });
});

describe('import refuses bad files and changes nothing', () => {
  const zipWith = (data: unknown) => zipSync({ 'data.json': strToU8(JSON.stringify(data)) });
  const valid = { format: 'mep-export', formatVersion: 1, schemaVersion: 1, tables: {} };

  async function expectRefused(bytes: Uint8Array, message: RegExp) {
    await target.collections.add({ name: 'keep me', members: [] });
    await expect(importData(bytes, target)).rejects.toThrow(ImportError);
    await expect(importData(bytes, target)).rejects.toThrow(message);
    expect(await target.collections.count()).toBe(1);
  }

  it('a file that is not a zip', () => expectRefused(strToU8('hello'), /couldn't be opened/));
  it('a zip without data.json', () => expectRefused(zipSync({ 'other.txt': strToU8('x') }), /no data\.json/));
  it('another app\'s file', () => expectRefused(zipWith({ ...valid, format: 'other' }), /isn't a Mep export/));
  it('an export from a newer Mep', () => expectRefused(zipWith({ ...valid, schemaVersion: 99 }), /newer version/));
  it('a table Mep does not know', () => expectRefused(zipWith({ ...valid, tables: { recipes: [] } }), /"recipes"/));
  it('a row without an id', () => expectRefused(zipWith({ ...valid, tables: { notes: [{ body: 'x' }] } }), /without an id/));
  it('a missing media file', () =>
    expectRefused(
      zipWith({ ...valid, tables: { media: [{ id: 'm1', createdAt: '', updatedAt: '', type: 'image/jpeg', file: 'media/m1.jpg' }] } }),
      /missing a photo/,
    ));
});

describe('exportFileName', () => {
  it('names the file by local date', () => {
    expect(exportFileName(new Date(2026, 10, 4))).toBe('mep-export-2026-11-04.zip');
  });
});

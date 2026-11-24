import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MepDatabase } from './db';
import { newId } from './ids';
import { checkPersistence, readMarker, writeMarker } from './storage';

let db: MepDatabase;

beforeEach(async () => {
  db = new MepDatabase(`storage-${newId()}`);
  await db.open();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

/** A fake navigator.storage that answers persist() with `grant`. */
function stubStorage(grant: boolean, alreadyPersisted = false) {
  const persist = vi.fn(async () => grant);
  vi.stubGlobal('navigator', {
    storage: { persisted: async () => alreadyPersisted, persist, estimate: async () => ({}) },
  });
  return persist;
}

describe('checkPersistence', () => {
  it('asks for persistent storage and records the first answer', async () => {
    const persist = stubStorage(true);
    const record = await checkPersistence(db);
    expect(persist).toHaveBeenCalledOnce();
    expect(record).toMatchObject({ supported: true, persisted: true, firstResult: true });
  });

  it("doesn't ask again once granted, and keeps the first answer", async () => {
    stubStorage(false);
    const first = await checkPersistence(db);
    const persist = stubStorage(true, true);
    const second = await checkPersistence(db);
    expect(persist).not.toHaveBeenCalled();
    expect(second).toMatchObject({ persisted: true, firstResult: false, firstAskedAt: first.firstAskedAt });
  });

  it('records "not supported" where there is no Storage API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await checkPersistence(db)).toMatchObject({ supported: false, persisted: false });
  });
});

describe('marker', () => {
  it('reads back what was written', async () => {
    expect(await readMarker(db)).toBeUndefined();
    const writtenAt = await writeMarker(db);
    expect(await readMarker(db)).toBe(writtenAt);
  });
});

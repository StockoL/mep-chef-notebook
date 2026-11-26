import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MepDatabase } from './db';
import { markHintSeen, seenHints } from './hints';
import { freshDatabase } from './testing';

let db: MepDatabase;
beforeEach(async () => {
  db = await freshDatabase();
});
afterEach(async () => {
  await db.delete();
});

describe('teach once', () => {
  it('remembers each hint seen, once', async () => {
    expect(await seenHints(db)).toEqual([]);
    await markHintSeen('method', db);
    await markHintSeen('method', db);
    await markHintSeen('lines', db);
    expect(await seenHints(db)).toEqual(['method', 'lines']);
  });
});

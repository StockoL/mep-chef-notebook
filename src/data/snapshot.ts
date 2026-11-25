/**
 * Undo for deletes that touch several tables (a component with its
 * variations, lines and steps). Delete functions return a Snapshot of every
 * row they removed or changed; restoreSnapshot puts them all back exactly.
 */

import { db as appDb, type MepDatabase, type TableName } from './db';

export type Snapshot = Partial<Record<TableName, object[]>>;

export async function restoreSnapshot(snapshot: Snapshot, database: MepDatabase = appDb): Promise<void> {
  const names = Object.keys(snapshot) as TableName[];
  await database.transaction(
    'rw',
    names.map((name) => database.table(name)),
    async () => {
      for (const name of names) await database.table(name).bulkPut(snapshot[name] ?? []);
    },
  );
}

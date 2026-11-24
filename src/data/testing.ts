/** Helpers for data tests: a fresh, uniquely named database per test. */
import 'fake-indexeddb/auto';
import { MepDatabase, ensureBuiltIns } from './db';
import { newId } from './ids';

export async function freshDatabase(): Promise<MepDatabase> {
  const database = new MepDatabase(`test-${newId()}`);
  await database.open();
  await ensureBuiltIns(database);
  return database;
}

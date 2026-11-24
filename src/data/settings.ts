import { db as appDb, type MepDatabase } from './db';

/** Reads one app setting; undefined if it has never been set. */
export async function getSetting<T>(key: string, database: MepDatabase = appDb): Promise<T | undefined> {
  const row = await database.settings.get(key);
  return row?.value as T | undefined;
}

/** Saves one app setting. */
export async function setSetting<T>(key: string, value: T, database: MepDatabase = appDb): Promise<void> {
  await database.settings.put({ key, value });
}

/**
 * Teach once (FEEL_PASS 4, UX principle 4). Helper text shows until the
 * chef has used that field, or seen that screen, once; then it goes. The
 * hints already seen are kept in settings as a list of names, so they
 * travel with an export.
 */

import { db as appDb, type MepDatabase } from './db';
import { getSetting, setSetting } from './settings';

const KEY = 'hints.seen';

export async function seenHints(database: MepDatabase = appDb): Promise<string[]> {
  return (await getSetting<string[]>(KEY, database)) ?? [];
}

export async function markHintSeen(name: string, database: MepDatabase = appDb): Promise<void> {
  const seen = await seenHints(database);
  if (!seen.includes(name)) await setSetting(KEY, [...seen, name], database);
}

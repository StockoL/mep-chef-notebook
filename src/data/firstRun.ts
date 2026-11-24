/** First run (F1): shown once, until the chef finishes or skips it. */

import { db as appDb, type MepDatabase } from './db';
import { nowTimestamp } from './ids';
import { getSetting, setSetting } from './settings';

const FIRST_RUN_KEY = 'firstRun.completedAt';

export async function isFirstRunDone(database: MepDatabase = appDb): Promise<boolean> {
  return (await getSetting<string>(FIRST_RUN_KEY, database)) !== undefined;
}

export async function completeFirstRun(database: MepDatabase = appDb) {
  await setSetting(FIRST_RUN_KEY, nowTimestamp(), database);
}

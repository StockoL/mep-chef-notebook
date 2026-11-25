import { ensureBuiltIns } from './db';
import { readUnreadSteps } from './steps';
import { checkPersistence } from './storage';

/** Runs once each time the app opens. */
export async function startData(): Promise<void> {
  await ensureBuiltIns();
  await readUnreadSteps();
  await checkPersistence();
}

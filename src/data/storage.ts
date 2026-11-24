import { db as appDb, type MepDatabase } from './db';
import { nowTimestamp } from './ids';
import { getSetting, setSetting } from './settings';

/**
 * Persistent storage (SPEC → Tech and data ownership). Browsers may clear a
 * site's storage when space runs low or the site goes unused; "persisted"
 * storage is exempt. Installing to the Home Screen is the other guard.
 */

const PERSISTENCE_KEY = 'storage.persistence';
const MARKER_KEY = 'storage.marker';

export interface PersistenceRecord {
  /** False on browsers without the Storage API. */
  supported: boolean;
  /** Whether storage is persisted, as of lastCheckedAt. */
  persisted: boolean;
  /** The answer the first time Mep asked (the Phase 0 log records this). */
  firstResult: boolean;
  firstAskedAt: string;
  lastCheckedAt: string;
}

/**
 * Asks for persistent storage if it isn't already granted, and records the
 * answer. Runs on every start: cheap, and the answer can change after the
 * app is installed.
 */
export async function checkPersistence(database: MepDatabase = appDb): Promise<PersistenceRecord> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  const supported = typeof storage?.persist === 'function';

  let persisted = false;
  if (supported && storage) {
    persisted = (await storage.persisted()) || (await storage.persist());
  }

  const previous = await getSetting<PersistenceRecord>(PERSISTENCE_KEY, database);
  const now = nowTimestamp();
  const record: PersistenceRecord = {
    supported,
    persisted,
    firstResult: previous?.firstResult ?? persisted,
    firstAskedAt: previous?.firstAskedAt ?? now,
    lastCheckedAt: now,
  };
  await setSetting(PERSISTENCE_KEY, record, database);
  return record;
}

export function getPersistenceRecord(database: MepDatabase = appDb) {
  return getSetting<PersistenceRecord>(PERSISTENCE_KEY, database);
}

/** How much space Mep uses and may use, in bytes; null where unknown. */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return usage === undefined || quota === undefined ? null : { usage, quota };
}

/**
 * The marker for the Phase 0 storage test: write it, leave the app unused for
 * a few days, and check it's still there.
 */
export async function writeMarker(database: MepDatabase = appDb): Promise<string> {
  const writtenAt = nowTimestamp();
  await setSetting(MARKER_KEY, writtenAt, database);
  return writtenAt;
}

export function readMarker(database: MepDatabase = appDb) {
  return getSetting<string>(MARKER_KEY, database);
}

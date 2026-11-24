/**
 * Backup reminders (D2): the phone holds the only copy, so the chef is
 * reminded until they export, never more than `everyDays` apart.
 */

import { daysBetween } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { nowTimestamp } from './ids';
import { getSetting, setSetting } from './settings';

const BACKUP_KEY = 'backup';

export const REMINDER_CHOICES = [1, 3, 7] as const;
export type ReminderDays = (typeof REMINDER_CHOICES)[number];

interface BackupSetting {
  lastBackupAt: string | null;
  everyDays: ReminderDays;
}

const DEFAULT: BackupSetting = { lastBackupAt: null, everyDays: 7 };

export interface BackupStatus extends BackupSetting {
  /** Whole days since the last backup; null if never. */
  daysSince: number | null;
  /** True when a reminder should show. */
  due: boolean;
}

export async function getBackupStatus(now = new Date(), database: MepDatabase = appDb): Promise<BackupStatus> {
  const setting = { ...DEFAULT, ...(await getSetting<BackupSetting>(BACKUP_KEY, database)) };
  const daysSince = setting.lastBackupAt ? daysBetween(new Date(setting.lastBackupAt), now) : null;
  // Never backed up: due as soon as there's anything worth keeping.
  const due = daysSince === null ? await hasChefData(database) : daysSince >= setting.everyDays;
  return { ...setting, daysSince, due };
}

export async function recordBackup(database: MepDatabase = appDb) {
  const setting = { ...DEFAULT, ...(await getSetting<BackupSetting>(BACKUP_KEY, database)) };
  await setSetting<BackupSetting>(BACKUP_KEY, { ...setting, lastBackupAt: nowTimestamp() }, database);
}

export async function setReminderDays(everyDays: ReminderDays, database: MepDatabase = appDb) {
  const setting = { ...DEFAULT, ...(await getSetting<BackupSetting>(BACKUP_KEY, database)) };
  await setSetting<BackupSetting>(BACKUP_KEY, { ...setting, everyDays }, database);
}

/** Anything the chef has made: notes, waste, goals, kitchens, components. */
async function hasChefData(database: MepDatabase): Promise<boolean> {
  const counts = await Promise.all([
    database.notes.count(),
    database.wasteEntries.count(),
    database.weeklyGoals.count(),
    database.components.count(),
    database.kitchens.filter((k) => !k.builtIn).count(),
  ]);
  return counts.some((count) => count > 0);
}

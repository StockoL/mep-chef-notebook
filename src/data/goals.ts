/** The weekly goal (G1): one line a week in the chef's words, a check-in, and a history. */

import { isoWeek, previousIsoWeek } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import type { WeeklyGoal } from './types';

export function getGoal(week: string, database: MepDatabase = appDb) {
  return database.weeklyGoals.where('week').equals(week).first();
}

export function getThisWeeksGoal(now = new Date(), database: MepDatabase = appDb) {
  return getGoal(isoWeek(now), database);
}

/** Saves the goal's text as it's typed; clearing it removes the goal. */
export async function setGoalText(week: string, text: string, database: MepDatabase = appDb) {
  const existing = await getGoal(week, database);
  const trimmed = text.trim();
  if (existing) {
    if (!trimmed && !existing.reflection) await database.weeklyGoals.delete(existing.id);
    else await database.weeklyGoals.update(existing.id, { text });
  } else if (trimmed) {
    await database.weeklyGoals.add({ week, text, reflection: null, suggestedFrom: null });
  }
}

export async function setReflection(week: string, reflection: string, database: MepDatabase = appDb) {
  const existing = await getGoal(week, database);
  if (existing) await database.weeklyGoals.update(existing.id, { reflection });
}

/** Last week's goal, if it hasn't been checked in yet. */
export async function getCheckInDue(now = new Date(), database: MepDatabase = appDb) {
  const last = await getGoal(previousIsoWeek(now), database);
  return last && last.reflection === null ? last : undefined;
}

/** Every goal, newest week first. */
export async function listGoals(database: MepDatabase = appDb): Promise<WeeklyGoal[]> {
  return database.weeklyGoals.orderBy('week').reverse().toArray();
}

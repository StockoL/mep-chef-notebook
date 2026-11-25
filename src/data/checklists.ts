/**
 * Opening and closing checklists (SPEC → Section admin; A6). One tap per
 * item; each day's ticks are kept (schema v7), so there's a history. Official
 * temperature records stay in the kitchen's own system.
 */

import { cleanName } from '../core/lists/lists';
import { toCalendarDate } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { newId } from './ids';
import { ListError } from './lists';
import type { CalendarDate, Checklist, ChecklistItem, ChecklistRun, Id } from './types';

export type ChecklistKind = Checklist['kind'];

/** A section's opening or closing checklist, made (empty) the first time it's asked for. */
export async function getChecklist(sectionId: Id, kind: ChecklistKind, database: MepDatabase = appDb): Promise<Checklist> {
  const existing = (await database.checklists.where('sectionId').equals(sectionId).toArray()).find((c) => c.kind === kind);
  if (existing) return existing;
  const id = await database.checklists.add({ sectionId, kind, items: [] });
  return (await database.checklists.get(id))!;
}

/** Read-only: the checklist if there is one (for live queries, which mustn't write). */
export async function findChecklist(sectionId: Id, kind: ChecklistKind, database: MepDatabase = appDb): Promise<Checklist | undefined> {
  return (await database.checklists.where('sectionId').equals(sectionId).toArray()).find((c) => c.kind === kind);
}

export async function addChecklistItem(sectionId: Id, kind: ChecklistKind, text: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(text);
  if (!cleaned) throw new ListError('Say what to check.');
  const list = await getChecklist(sectionId, kind, database);
  const item: ChecklistItem = { id: newId(), text: cleaned, order: list.items.reduce((m, i) => Math.max(m, i.order + 1), 0) };
  await database.checklists.update(list.id, { items: [...list.items, item] });
  return item.id;
}

export async function renameChecklistItem(checklistId: Id, itemId: Id, text: string, database: MepDatabase = appDb) {
  const list = await database.checklists.get(checklistId);
  if (!list || !cleanName(text)) return;
  await database.checklists.update(checklistId, { items: list.items.map((i) => (i.id === itemId ? { ...i, text: cleanName(text) } : i)) });
}

/** Takes an item off; returns it for Undo. */
export async function removeChecklistItem(checklistId: Id, itemId: Id, database: MepDatabase = appDb): Promise<ChecklistItem | undefined> {
  const list = await database.checklists.get(checklistId);
  const item = list?.items.find((i) => i.id === itemId);
  if (list) await database.checklists.update(checklistId, { items: list.items.filter((i) => i.id !== itemId) });
  return item;
}

export async function restoreChecklistItem(checklistId: Id, item: ChecklistItem, database: MepDatabase = appDb) {
  const list = await database.checklists.get(checklistId);
  if (list) await database.checklists.update(checklistId, { items: [...list.items, item].sort((a, b) => a.order - b.order) });
}

export async function moveChecklistItem(checklistId: Id, itemId: Id, direction: -1 | 1, database: MepDatabase = appDb) {
  const list = await database.checklists.get(checklistId);
  if (!list) return;
  const items = [...list.items].sort((a, b) => a.order - b.order);
  const index = items.findIndex((i) => i.id === itemId);
  const other = items[index + direction];
  if (!other) return;
  [items[index], items[index + direction]] = [other, items[index]!];
  await database.checklists.update(checklistId, { items: items.map((i, order) => ({ ...i, order })) });
}

/** Today's ticks on a checklist (read-only). */
export async function getRun(checklistId: Id, date: CalendarDate = toCalendarDate(new Date()), database: MepDatabase = appDb): Promise<ChecklistRun | undefined> {
  return database.checklistRuns.where('[checklistId+date]').equals([checklistId, date]).first();
}

/** Ticks or unticks an item for today: one tap (A6). */
export async function toggleTick(checklistId: Id, itemId: Id, now = new Date(), database: MepDatabase = appDb) {
  const date = toCalendarDate(now);
  await database.transaction('rw', database.checklistRuns, async () => {
    const run = await getRun(checklistId, date, database);
    const ticked = run?.ticked ?? [];
    const next = ticked.some((t) => t.itemId === itemId) ? ticked.filter((t) => t.itemId !== itemId) : [...ticked, { itemId, at: now.toISOString() }];
    if (run) await database.checklistRuns.update(run.id, { ticked: next });
    else await database.checklistRuns.add({ checklistId, date, ticked: next });
  });
}

/** Past days for a checklist, newest first: how many of how many were ticked. */
export async function checklistHistory(checklistId: Id, database: MepDatabase = appDb): Promise<{ date: CalendarDate; ticked: number }[]> {
  const runs = await database.checklistRuns.filter((r) => r.checklistId === checklistId).toArray();
  return runs.map((r) => ({ date: r.date, ticked: r.ticked.length })).sort((a, b) => b.date.localeCompare(a.date));
}

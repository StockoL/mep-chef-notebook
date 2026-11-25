/**
 * The prep plan (SPEC → The prep plan; PS1–PS3, PS5; DECISIONS 19, 50).
 *
 * The plan is today's sheet in time order, never a second list. This file
 * turns the sheet into the scheduler's input and back:
 * - each unticked item whose recipe is ready becomes a job: its steps' parts
 *   in order (times on the upper end), ready by its service (or the first
 *   service you work today, or the end of your shift);
 * - drafts and items with no recipe sit beside the plan as to-dos (PS2);
 * - steps that start the day before (cures, overnight sets) are planned on
 *   the day before: tomorrow's sheet puts them in today's plan (PS3), and
 *   today's items skip them, noting they were started yesterday.
 * Nothing is stored: the plan is worked out each time it's shown, from the
 * start of today's shift.
 */

import { scheduler, type Plan, type PlanJob, type PlanPart, type ServiceWindow } from '../core/scheduler/scheduler';
import { servicesOn } from '../core/services/nextService';
import { minutesOfDay, timeToMinutes, toCalendarDate, isoDayOfWeek } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { eventInputs } from './events';
import { getVariationInUse } from './library';
import { listServices, listShifts } from './kitchens';
import { findSheet, getSheetView, type SheetItemView } from './sheets';
import type { CalendarDate, Id, KitchenId, StepPart } from './types';

/** When a service has no last-bookings time, its window is taken as this long. */
const DEFAULT_SERVICE_MINUTES = 120;

export interface PlanJobInfo {
  view: SheetItemView;
  /** "today": an item on today's sheet. "tomorrow": the day-before steps of an item on tomorrow's sheet. */
  forDay: 'today' | 'tomorrow';
  /** "Ready by Lunch", "Ready by the end of your shift". */
  readyByLabel: string | null;
  /** Steps that should already have been started the day before. */
  startedYesterday: string[];
}

export interface PlanToDo {
  view: SheetItemView;
  /** "Draft: step 2 has no time", "No recipe". */
  reason: string;
}

export interface PlanView {
  date: CalendarDate;
  start: number;
  windows: ServiceWindow[];
  plan: Plan;
  jobs: Map<string, PlanJobInfo>;
  /** Beside the plan (PS2). */
  todos: PlanToDo[];
  done: SheetItemView[];
  /** What's missing for a better plan: "no service times", "no shift". */
  hints: string[];
  sheetId: Id | null;
}

/** Works out the plan for a kitchen's sheet on a date, from `now` if it's today. */
export async function getPlanView(kitchenId: KitchenId, now: Date, database: MepDatabase = appDb): Promise<PlanView> {
  const date = toCalendarDate(now);
  const [services, events, shifts] = await Promise.all([listServices(kitchenId, database), eventInputs(kitchenId, date, database), listShifts(kitchenId, database)]);
  const todays = servicesOn(now, services, events);
  const windows: ServiceWindow[] = todays.map((s) => {
    const start = timeToMinutes(s.start);
    return { name: s.name, start, end: s.end ? timeToMinutes(s.end) : start + DEFAULT_SERVICE_MINUTES };
  });
  const shift = shifts.find((s) => s.days.includes(isoDayOfWeek(now) as never));
  const shiftStart = shift ? timeToMinutes(shift.start) : null;
  const shiftEnd = shift ? timeToMinutes(shift.end) : null;
  // The whole shift is planned from its start, so the plan holds still as the
  // day goes on (what's started is only known once prep mode tracks it).
  // With no shift set, it starts now.
  const start = shiftStart ?? minutesOfDay(now);

  const hints: string[] = [];
  if (windows.length === 0) hints.push('No service times today, so nothing has a ready-by time. Set them in kitchen settings → Services.');
  if (!shift) hints.push('No shift set for today, so the plan starts now.');

  // Ready by: the item's service; else the first service still to come; else the end of the shift.
  const readyBy = (serviceId: Id | null): { at: number | null; label: string | null } => {
    if (serviceId) {
      const own = todays.find((s) => s.id === serviceId);
      const replacing = events.find((e) => e.date === date && e.replacesServiceId === serviceId)?.services[0];
      const service = own ?? (replacing ? todays.find((s) => s.id === replacing.id) : undefined);
      if (service) return { at: timeToMinutes(service.start), label: `Ready by ${service.name}` };
    }
    const next = todays.find((s) => timeToMinutes(s.start) > start);
    if (next) return { at: timeToMinutes(next.start), label: `Ready by ${next.name}` };
    if (shiftEnd !== null) return { at: shiftEnd, label: 'Ready by the end of your shift' };
    return { at: null, label: null };
  };

  const sheet = await findSheet(kitchenId, date, [], database);
  const view = sheet ? await getSheetView(sheet.id, kitchenId, database) : undefined;
  const items = view?.items ?? [];

  const jobs: PlanJob[] = [];
  const info = new Map<string, PlanJobInfo>();
  const todos: PlanToDo[] = [];
  const componentJob = new Map<Id, string>();

  for (const item of items.filter((i) => !i.item.done)) {
    const recipe = await readyParts(item, kitchenId, database);
    if ('reason' in recipe) {
      todos.push({ view: item, reason: recipe.reason });
      continue;
    }
    const { today, yesterday } = splitAtPreviousDay(recipe.parts);
    const by = readyBy(item.item.serviceId);
    const planParts = today.map(toPlanPart);
    // Held warm for a limited time ("hold warm max 2 hrs"): not made so early it would be held longer.
    const total = planParts.reduce((sum, p) => sum + p.minutes, 0);
    const notBefore = recipe.warmHoldMinutes !== null && by.at !== null ? by.at - recipe.warmHoldMinutes - total : undefined;
    jobs.push({ id: item.item.id, label: item.name, parts: planParts, readyBy: by.at, after: recipe.needs, notBefore });
    info.set(item.item.id, { view: item, forDay: 'today', readyByLabel: by.label, startedYesterday: yesterday.map((p) => p.text) });
    if (item.componentId) componentJob.set(item.componentId, item.item.id);
  }

  // Tomorrow's sheet: anything that has to be started today (PS3).
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextSheet = await findSheet(kitchenId, toCalendarDate(tomorrow), [], database);
  const nextView = nextSheet ? await getSheetView(nextSheet.id, kitchenId, database) : undefined;
  for (const item of nextView?.items.filter((i) => !i.item.done) ?? []) {
    const recipe = await readyParts(item, kitchenId, database);
    if ('reason' in recipe) continue;
    const { yesterday } = splitAtPreviousDay(recipe.parts);
    if (yesterday.length === 0) continue;
    const last = yesterday.at(-1)!;
    // It only has to be started by the end of the shift: the last part (the cure, the overnight set) runs on.
    const end = shiftEnd ?? 23 * 60;
    const lastMinutes = last.mode === 'passive' ? (last.minutesMax ?? last.minutesMin ?? 0) : 0;
    const id = `tomorrow-${item.item.id}`;
    jobs.push({ id, label: item.name, parts: yesterday.map(toPlanPart), readyBy: end + lastMinutes });
    info.set(id, { view: item, forDay: 'tomorrow', readyByLabel: 'For tomorrow: started before you go', startedYesterday: [] });
  }

  // "Needs the stock": wait for the job making it, if it's on the sheet.
  for (const job of jobs) {
    job.after = (job.after ?? []).map((componentId) => componentJob.get(componentId)).filter((id): id is string => id !== undefined && id !== job.id);
  }

  return {
    date,
    start,
    windows,
    plan: scheduler.plan({ start, jobs, windows }),
    jobs: info,
    todos,
    done: items.filter((i) => i.item.done),
    hints,
    sheetId: sheet?.id ?? null,
  };
}

/** A sheet item's recipe parts, if its recipe is ready; otherwise why it's a to-do. */
async function readyParts(
  item: SheetItemView,
  kitchenId: KitchenId,
  database: MepDatabase,
): Promise<{ parts: StepPart[]; needs: Id[]; warmHoldMinutes: number | null } | { reason: string }> {
  if (!item.componentId) return { reason: 'No recipe: tick it off by hand' };
  const variation = await getVariationInUse(item.componentId, kitchenId, database);
  if (!variation?.currentVersionId || variation.status !== 'ready') return { reason: 'Draft: not in the plan until its method is confirmed' };
  const steps = await database.steps.where('versionId').equals(variation.currentVersionId).sortBy('order');
  const all = steps.flatMap((s) => s.parts);
  // Done at service ("to order") and holds aren't prep; a warm hold limits how early it's made.
  const parts = all.filter((p) => !p.atService && !(p.mode === null && p.hold));
  const warm = all.find((p) => p.hold?.where === 'warm')?.hold;
  return { parts, needs: [...new Set(parts.flatMap((p) => p.dependsOnComponentIds))], warmHoldMinutes: warm?.minutes ?? null };
}

/** Parts up to the last day-before part happen the day before; the rest today. */
function splitAtPreviousDay(parts: StepPart[]): { yesterday: StepPart[]; today: StepPart[] } {
  const last = parts.map((p) => p.previousDay).lastIndexOf(true);
  return { yesterday: parts.slice(0, last + 1), today: parts.slice(last + 1) };
}

function toPlanPart(part: StepPart, index: number): PlanPart {
  return {
    key: `${index}`,
    label: part.text,
    mode: part.mode ?? 'active',
    // Plans on the upper end (SPEC → Tokens: Duration).
    minutes: part.minutesMax ?? part.minutesMin ?? 0,
    equipment: part.equipmentTypeId,
    setting: part.equipmentSetting,
    pausable: part.pausable,
    pauseBlocker: part.pauseBlocker,
    noGap: part.noGap,
  };
}

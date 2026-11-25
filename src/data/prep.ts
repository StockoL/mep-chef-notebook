/**
 * Prep mode (SPEC → Prep mode and learned timings; SM1–SM4; DECISIONS 51).
 *
 * Records what's been started and finished today (`partRuns`, schema v6),
 * so prep mode picks up where it was if the app is closed, and turns each
 * finished step into a timing for learning (SM3). The plan itself isn't
 * stored: prep mode works it out from the day's plan and these records
 * (src/core/prep/progress.ts).
 */

import { prepState, type PartRun as CorePartRun, type PrepState } from '../core/prep/progress';
import type { PlacedPart } from '../core/scheduler/scheduler';
import { minutesOfDay, toCalendarDate } from '../core/time/calendar';
import { db as appDb, type MepDatabase } from './db';
import { getPlanView, type PlanView } from './plan';
import type { Id, KitchenId, PartRun } from './types';

export interface PrepView {
  plan: PlanView;
  state: PrepState;
  /** Today's records, by "jobId|partKey". */
  runs: Map<string, PartRun>;
}

export const runKey = (jobId: string, partKey: string) => `${jobId}|${partKey}`;

/** The day's plan, where prep has got to, and today's records. */
export async function getPrepView(kitchenId: KitchenId, now: Date, database: MepDatabase = appDb): Promise<PrepView> {
  const plan = await getPlanView(kitchenId, now, database);
  const rows = await database.partRuns.where('[kitchenId+date]').equals([kitchenId, toCalendarDate(now)]).toArray();
  const runs: CorePartRun[] = rows.map((r) => ({
    jobId: r.jobId,
    partKey: r.partKey,
    startedAt: minutesOfDay(new Date(r.startedAt)),
    doneAt: r.doneAt ? minutesOfDay(new Date(r.doneAt)) : null,
  }));
  const state = prepState({ plan: plan.plan, jobs: plan.planJobs, windows: plan.windows, runs, now: minutesOfDay(now) });
  return { plan, state, runs: new Map(rows.map((r) => [runKey(r.jobId, r.partKey), r])) };
}

/** Starts a step: the clock runs from now. Returns the record's id. */
export async function startPart(kitchenId: KitchenId, part: PlacedPart, view: PrepView, now = new Date(), database: MepDatabase = appDb): Promise<Id> {
  const planPart = view.plan.planJobs.find((j) => j.id === part.jobId)?.parts.find((p) => p.key === part.partKey);
  const existing = view.runs.get(runKey(part.jobId, part.partKey));
  if (existing) return existing.id;
  return database.partRuns.add({
    kitchenId,
    date: toCalendarDate(now),
    jobId: part.jobId,
    partKey: part.partKey,
    stepKey: planPart?.stepKey ?? null,
    mode: part.mode,
    equipmentTypeId: part.equipment,
    quantity: view.plan.jobs.get(part.jobId)?.batch ?? null,
    startedAt: now.toISOString(),
    doneAt: null,
    interrupted: false,
    inServiceWindow: view.state.inService !== null,
  });
}

export interface Finished {
  runId: Id;
  timingId: Id | null;
  /** The sheet item ticked because this was its job's last step. */
  tickedItemId: Id | null;
}

/**
 * Finishes a step (SM1): records how long it took (SM3; left out of
 * learning if interrupted), and ticks the sheet item when it was the job's
 * last step. Returns what Undo needs.
 */
export async function finishPart(runId: Id, view: PrepView, options: { interrupted?: boolean } = {}, now = new Date(), database: MepDatabase = appDb): Promise<Finished> {
  return database.transaction('rw', [database.partRuns, database.timings, database.sheetItems], async () => {
    const run = await database.partRuns.get(runId);
    if (!run) return { runId, timingId: null, tickedItemId: null };
    const interrupted = options.interrupted ?? false;
    await database.partRuns.update(runId, { doneAt: now.toISOString(), interrupted });

    const minutes = Math.round(((now.getTime() - Date.parse(run.startedAt)) / 60_000) * 10) / 10;
    // Done within half a minute of starting is a mis-tap, not a time to learn from.
    const timingId = run.stepKey && minutes >= 0.5
      ? await database.timings.add({
          stepKey: run.stepKey,
          // Hands-on times are yours; times left in equipment belong to this kitchen's equipment.
          equipmentId: run.mode === 'active' ? null : run.equipmentTypeId,
          kitchenId: run.kitchenId,
          quantity: run.quantity,
          minutes,
          interrupted,
          inServiceWindow: run.inServiceWindow,
        })
      : null;

    // The job's last step done: tick it on the sheet (the plan and the sheet are one list).
    const job = view.plan.planJobs.find((j) => j.id === run.jobId);
    const done = new Set(
      (await database.partRuns.where('[kitchenId+date]').equals([run.kitchenId, run.date]).toArray())
        .filter((r) => r.jobId === run.jobId && r.doneAt)
        .map((r) => r.partKey),
    );
    const jobDone = job !== undefined && job.parts.every((p) => done.has(p.key));
    const itemId = run.jobId.startsWith('tomorrow-') ? null : run.jobId;
    let tickedItemId: Id | null = null;
    if (jobDone && itemId && (await database.sheetItems.get(itemId))) {
      await database.sheetItems.update(itemId, { done: true });
      tickedItemId = itemId;
    }
    return { runId, timingId, tickedItemId };
  });
}

/** Undo a "done": the step's running again, its timing forgotten, the sheet item unticked. */
export async function undoFinish(finished: Finished, database: MepDatabase = appDb) {
  await database.transaction('rw', [database.partRuns, database.timings, database.sheetItems], async () => {
    await database.partRuns.update(finished.runId, { doneAt: null, interrupted: false });
    if (finished.timingId) await database.timings.delete(finished.timingId);
    if (finished.tickedItemId) await database.sheetItems.update(finished.tickedItemId, { done: false });
  });
}

/** Undo a "start": it's back in the queue, as if never started. */
export async function undoStart(runId: Id, database: MepDatabase = appDb) {
  await database.partRuns.delete(runId);
}

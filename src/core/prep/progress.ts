/**
 * Where prep has got to (SPEC → Prep mode; SM1, SM2; DECISIONS 51). Pure.
 *
 * Given the day's plan, what's been started and finished, and the time:
 * - what's running (started, not done), with when it should end;
 * - the queue of unstarted parts, in the plan's order;
 * - how far behind (or ahead) the plan you are.
 *
 * The plan stays put unless it matters (SM2): being behind only re-orders
 * the unstarted parts when it would make a job late for its ready-by time.
 * Otherwise it just says "6 min behind". During a service window nothing is
 * re-ordered: the order is kept and the countdown dropped.
 */

import { scheduler, type PlacedPart, type Plan, type PlanJob, type ServiceWindow } from '../scheduler/scheduler';

/** A part that's been started today (prep mode's record), in minutes from midnight. */
export interface PartRun {
  jobId: string;
  partKey: string;
  startedAt: number;
  doneAt: number | null;
}

export interface PrepInput {
  /** The day's plan as first worked out, and the jobs it came from. */
  plan: Plan;
  jobs: readonly PlanJob[];
  windows: readonly ServiceWindow[];
  runs: readonly PartRun[];
  now: number;
}

export interface Running {
  part: PlacedPart;
  startedAt: number;
  /** When it should be done: started + its planned time. */
  dueAt: number;
}

export interface PrepState {
  running: Running[];
  /** Unstarted parts, in order: the first is the current task. */
  queue: PlacedPart[];
  /** Minutes behind the plan; negative = ahead. */
  behind: number;
  /** Jobs the queue was re-ordered for, because they'd have been late; null if it wasn't. */
  replannedFor: string[] | null;
  /** The service on now, if any: order kept, no countdown. */
  inService: ServiceWindow | null;
  done: number;
  total: number;
}

const key = (jobId: string, partKey: string) => `${jobId}|${partKey}`;

export function prepState({ plan, jobs, windows, runs, now }: PrepInput): PrepState {
  const runFor = new Map(runs.map((r) => [key(r.jobId, r.partKey), r]));
  const planned = plan.parts;
  const running: Running[] = planned.flatMap((part) => {
    const run = runFor.get(key(part.jobId, part.partKey));
    return run && run.doneAt === null ? [{ part, startedAt: run.startedAt, dueAt: run.startedAt + (part.end - part.start) }] : [];
  });
  const unstarted = planned.filter((part) => !runFor.has(key(part.jobId, part.partKey)));
  const done = planned.filter((part) => runFor.get(key(part.jobId, part.partKey))?.doneAt != null).length;
  const inService = windows.find((w) => w.start <= now && now < w.end) ?? null;

  // Hands are free once the hands-on part running now is due to finish.
  const handsFree = Math.max(now, ...running.filter((r) => r.part.mode === 'active').map((r) => r.dueAt));
  const first = unstarted[0];
  const behind = first ? handsFree - first.start : 0;

  const base = { running, done, total: planned.length, inService, behind };
  if (!first || inService) return { ...base, queue: unstarted, replannedFor: null };

  // Would being behind make a job late? Each job slips by the time you're
  // behind, or by how long its own running part has overrun, whichever's more.
  const delayFor = (jobId: string) =>
    Math.max(behind, 0, ...running.filter((r) => r.part.jobId === jobId).map((r) => Math.max(now, r.dueAt) - r.dueAt));
  const atRisk = plan.jobs
    .filter((job) => job.readyBy !== null && job.end <= job.readyBy && job.end + delayFor(job.jobId) > job.readyBy)
    .filter((job) => unstarted.some((p) => p.jobId === job.jobId))
    .map((job) => job.jobId);
  if (atRisk.length === 0) return { ...base, queue: unstarted, replannedFor: null };

  // Re-order only what hasn't started, around what's running.
  const busy: PlacedPart[] = running.map((r) => ({ ...r.part, start: r.startedAt, end: Math.max(r.dueAt, now + 1) }));
  const remaining: PlanJob[] = jobs.flatMap((job) => {
    const left = job.parts.filter((p) => !runFor.has(key(job.id, p.key)));
    if (left.length === 0) return [];
    const runningPart = busy.find((b) => b.jobId === job.id);
    return [{ ...job, parts: left, notBefore: Math.max(now, runningPart?.end ?? now, job.notBefore ?? now) }];
  });
  const replanned = scheduler.plan({ start: now, jobs: remaining, windows, busy });
  return { ...base, queue: [...replanned.parts], replannedFor: atRisk };
}

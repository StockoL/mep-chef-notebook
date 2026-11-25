/**
 * The prep scheduler (SPEC → The prep plan; PS1, PS3, PS5; DECISIONS 6, 50).
 *
 * It sits behind one interface: the UI and the data only ever call
 * `scheduler.plan(input)`, so the algorithm can be swapped (critical path, a
 * constraint solver) without touching them.
 *
 * Times are minutes from midnight of the day being planned.
 *
 * The first algorithm is SPEC's greedy baseline, run as a simple simulation
 * of the shift:
 * 1. Each job (a sheet item) is a chain of parts that run in order.
 * 2. At each moment, of the parts that could start, the one with the least
 *    slack (how long until it must start to be ready in time) goes first, so
 *    long passive chains start early and urgent work isn't left behind.
 * 3. Your hands: never two active parts at once; up to two check-in parts
 *    alongside; passive parts run on their own.
 * 4. Equipment: two parts can't share equipment at different settings (an
 *    oven at 220°C and one at 160°C). The later one waits.
 * 5. Service windows: a part that can't be left for a ticket waits until
 *    the window is over if it can still be ready in time; if it can't, it
 *    goes in the window, flagged "needs cover" with the reason.
 * 6. Something held warm for a limited time isn't started so early it
 *    would be held longer (`notBefore`).
 * 7. Free time is shown; anything that can't be ready in time is flagged.
 */

export type PlanMode = 'active' | 'check-in' | 'passive';

/** One piece of work: a step's part, as the planner needs it. */
export interface PlanPart {
  /** Unique within the job. */
  key: string;
  label: string;
  mode: PlanMode;
  minutes: number;
  /** Equipment it ties up (any id or name), or null. */
  equipment: string | null;
  /** "220°C": parts on the same equipment at different settings can't overlap. */
  setting: string | null;
  /** false when it can't be left for a ticket. */
  pausable: boolean;
  /** Why not: "cooling", "emulsion". */
  pauseBlocker: string | null;
  /** Must start as soon as the part before ends ("while hot"). */
  noGap: boolean;
  /** Which step this is, for learned times (DECISIONS 51). */
  stepKey?: string;
  /** Its time was learned from this many timings, rather than written. */
  learnedFrom?: number;
}

/** One job to place: a sheet item, as a chain of parts. */
export interface PlanJob {
  id: string;
  label: string;
  parts: readonly PlanPart[];
  /** When it must be ready by (minutes), or null for "no deadline". */
  readyBy: number | null;
  /** Jobs that must be finished before this one starts ("needs the stock"). */
  after?: readonly string[];
  /**
   * The earliest it may start (minutes). For something held warm for a
   * limited time ("hold warm max 2 hrs"), so it isn't made too early.
   */
  notBefore?: number;
}

/** A service: prep can carry on, but someone has to cover what can't be left. */
export interface ServiceWindow {
  name: string;
  start: number;
  end: number;
}

export interface PlanInput {
  /** When prep starts: now, or the start of the shift. */
  start: number;
  jobs: readonly PlanJob[];
  windows?: readonly ServiceWindow[];
  /**
   * Parts already running (prep mode): they hold your hands and equipment
   * until they end, but aren't placed again or returned.
   */
  busy?: readonly PlacedPart[];
}

export interface PlacedPart {
  jobId: string;
  partKey: string;
  label: string;
  mode: PlanMode;
  start: number;
  end: number;
  equipment: string | null;
  setting: string | null;
  /** In a service window and can't be left: "cooling". */
  needsCover: string | null;
  /** Should have followed the part before at once, but couldn't. */
  gapBefore: boolean;
}

export interface PlannedJob {
  jobId: string;
  start: number;
  end: number;
  readyBy: number | null;
  /** Minutes past its ready-by time (0 when on time). */
  late: number;
}

export interface Plan {
  /** Every placed part, in start order. */
  parts: readonly PlacedPart[];
  jobs: readonly PlannedJob[];
  /** Stretches with nothing for your hands to do (active or check-in), 5 minutes or more. */
  free: readonly { start: number; end: number }[];
  /** Jobs that couldn't be placed at all, with why. */
  unplaced: readonly { jobId: string; reason: string }[];
}

/** Anything with a plan() method that takes a PlanInput and returns a Plan. */
export interface Scheduler {
  plan(input: PlanInput): Plan;
}

const MAX_CHECK_INS = 2;
const MIN_FREE = 5;

interface JobState {
  job: PlanJob;
  next: number;
  /** When the part before finished. */
  readyAt: number;
  done: boolean;
  end: number;
  start: number | null;
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

export const greedyScheduler: Scheduler = {
  plan(input) {
    const windows = input.windows ?? [];
    const states = new Map<string, JobState>(
      input.jobs.map((job) => [
        job.id,
        { job, next: 0, readyAt: Math.max(input.start, job.notBefore ?? input.start), done: job.parts.length === 0, end: input.start, start: null },
      ]),
    );
    const busy = input.busy ?? [];
    const placed: PlacedPart[] = [...busy];
    const unplaced: { jobId: string; reason: string }[] = [];
    // A job waiting on one that isn't in the plan just doesn't wait.
    const after = (job: PlanJob) => (job.after ?? []).filter((id) => states.has(id) && id !== job.id);

    const remaining = (state: JobState) => state.job.parts.slice(state.next).reduce((sum, p) => sum + p.minutes, 0);
    const slack = (state: JobState, t: number) => (state.job.readyBy === null ? Number.POSITIVE_INFINITY : state.job.readyBy - t - remaining(state));
    const running = (t: number) => placed.filter((p) => p.start <= t && p.end > t);
    const window = (span: { start: number; end: number }) => windows.find((w) => overlaps(w, span));

    const fits = (part: PlanPart, t: number) => {
      const now = running(t);
      if (part.mode === 'active' && now.some((p) => p.mode === 'active')) return false;
      if (part.mode === 'check-in' && now.filter((p) => p.mode === 'check-in').length >= MAX_CHECK_INS) return false;
      if (part.equipment && part.setting && now.some((p) => p.equipment === part.equipment && p.setting && p.setting !== part.setting)) return false;
      return true;
    };

    let t = input.start;
    for (let guard = 0; guard < 10_000; guard++) {
      const waiting = [...states.values()].filter((s) => !s.done);
      if (waiting.length === 0) break;

      const ready = waiting
        .filter((s) => s.readyAt <= t && after(s.job).every((id) => states.get(id)!.done && states.get(id)!.end <= t))
        .sort((a, b) => {
          // A part that must follow on at once goes first; then least slack.
          const ga = Number(a.job.parts[a.next]!.noGap && a.next > 0);
          const gb = Number(b.job.parts[b.next]!.noGap && b.next > 0);
          return gb - ga || slack(a, t) - slack(b, t);
        });

      let deferredUntil = Number.POSITIVE_INFINITY;
      for (const state of ready) {
        const part = state.job.parts[state.next]!;
        if (!fits(part, t)) continue;
        const span = { start: t, end: t + part.minutes };
        const service = window(span);
        if (service && !part.pausable) {
          // Wait for the service to finish, if it can still be ready in time.
          const canWait = state.job.readyBy === null || service.end + remaining(state) <= state.job.readyBy;
          if (canWait) {
            deferredUntil = Math.min(deferredUntil, service.end);
            continue;
          }
        }
        placed.push({
          jobId: state.job.id,
          partKey: part.key,
          label: part.label,
          mode: part.mode,
          start: t,
          end: span.end,
          equipment: part.equipment,
          setting: part.setting,
          needsCover: service && !part.pausable ? (part.pauseBlocker ?? 'can’t be left') : null,
          gapBefore: part.noGap && state.next > 0 && t > state.readyAt,
        });
        state.start ??= t;
        state.next += 1;
        state.readyAt = span.end;
        state.end = span.end;
        if (state.next >= state.job.parts.length) state.done = true;
      }

      // Move on to the next moment anything changes.
      const events = [
        ...placed.map((p) => p.end),
        ...[...states.values()].filter((s) => !s.done).map((s) => s.readyAt),
        deferredUntil,
      ].filter((time) => time > t && Number.isFinite(time));
      if (events.length === 0) {
        for (const state of states.values()) {
          if (!state.done) unplaced.push({ jobId: state.job.id, reason: 'It waits on a job that waits on it.' });
        }
        break;
      }
      t = Math.min(...events);
    }

    const result = placed.filter((p) => !busy.includes(p)).sort((a, b) => a.start - b.start || a.end - b.end);
    const jobs: PlannedJob[] = [...states.values()]
      .filter((s) => s.start !== null)
      .map((s) => ({
        jobId: s.job.id,
        start: s.start!,
        end: s.end,
        readyBy: s.job.readyBy,
        late: s.job.readyBy === null ? 0 : Math.max(0, s.end - s.job.readyBy),
      }))
      .sort((a, b) => a.start - b.start);

    return { parts: result, jobs, free: freeTime(result, input.start), unplaced };
  },
};

/** Gaps where your hands are free: no active or check-in part running. */
export function freeTime(parts: readonly PlacedPart[], start: number): { start: number; end: number }[] {
  const busy = parts.filter((p) => p.mode !== 'passive').sort((a, b) => a.start - b.start);
  const end = Math.max(start, ...parts.map((p) => p.end));
  const free: { start: number; end: number }[] = [];
  let cursor = start;
  for (const part of busy) {
    if (part.start - cursor >= MIN_FREE) free.push({ start: cursor, end: part.start });
    cursor = Math.max(cursor, part.end);
  }
  if (end - cursor >= MIN_FREE) free.push({ start: cursor, end });
  return free;
}

/** The scheduler the app uses. Swap it here. */
export const scheduler: Scheduler = greedyScheduler;

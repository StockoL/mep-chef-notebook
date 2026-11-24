/**
 * The prep scheduler sits behind this interface (DECISIONS 6, CLAUDE.md):
 * the UI and the data only ever call `scheduler.plan(input)`, so the
 * algorithm can be swapped without touching them. Phase 8 fills in the
 * input (steps, modes, equipment, ready-by times) and the first real
 * algorithm; these types are the minimum shape for now.
 */

/** One job to place: a sheet item, later with its steps. */
export interface PlanJob {
  id: string;
  label: string;
}

/** A job given a time. Minutes from the start of the shift. */
export interface PlacedJob {
  jobId: string;
  start: number;
  end: number;
}

export interface PlanInput {
  jobs: readonly PlanJob[];
}

export interface Plan {
  placed: readonly PlacedJob[];
  /** Jobs that couldn't be placed: shown beside the plan as manual to-dos. */
  unplaced: readonly PlanJob[];
}

/** Anything with a plan() method that takes a PlanInput and returns a Plan. */
export interface Scheduler {
  plan(input: PlanInput): Plan;
}

/** Placeholder until Phase 8: places nothing, so every job stays a to-do. */
export const placeholderScheduler: Scheduler = {
  plan(input) {
    return { placed: [], unplaced: [...input.jobs] };
  },
};

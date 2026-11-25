/**
 * Learning how long a step takes (SPEC → Prep mode and learned timings; SM3;
 * DECISIONS 51). Pure: give it the recorded timings for one step.
 *
 * - Interrupted timings don't count, nor do ones taken during service (kept
 *   apart: a job done between tickets isn't a normal time).
 * - At least MIN_TIMINGS before a learned time replaces the written one.
 * - Median, not mean (one disaster doesn't skew it), with recent timings
 *   weighted more: a timing's weight halves every HALF_LIFE_DAYS.
 * - With timings at different batch sizes, the time scales with quantity
 *   as a setup time plus a per-batch rate (a weighted straight-line fit).
 */

export interface RecordedTiming {
  minutes: number;
  /** Batch size as a multiple of the recipe (1 = as written), or null if unknown. */
  quantity: number | null;
  /** When it was recorded, in ms. */
  at: number;
  interrupted: boolean;
  inServiceWindow: boolean;
}

export interface Learned {
  minutes: number;
  /** How many timings it's based on. */
  count: number;
}

export const MIN_TIMINGS = 3;
export const HALF_LIFE_DAYS = 30;
const DAY = 86_400_000;

/** A learned time for this batch size (1 if not given), or null while there aren't enough timings. */
export function learnedMinutes(timings: readonly RecordedTiming[], now: number, quantity = 1): Learned | null {
  const usable = timings.filter((t) => !t.interrupted && !t.inServiceWindow && t.minutes > 0);
  if (usable.length < MIN_TIMINGS) return null;
  const weighted = usable.map((t) => ({ ...t, weight: 0.5 ** (Math.max(0, now - t.at) / DAY / HALF_LIFE_DAYS) }));

  const sized = weighted.filter((t) => t.quantity !== null && t.quantity > 0);
  const sizes = new Set(sized.map((t) => t.quantity));
  if (sized.length >= MIN_TIMINGS && sizes.size >= 2) {
    const fit = fitLine(sized.map((t) => ({ x: t.quantity!, y: t.minutes, w: t.weight })));
    if (fit) return { minutes: round(Math.max(1, fit.setup + fit.rate * quantity)), count: usable.length };
  }
  return { minutes: round(weightedMedian(weighted.map((t) => ({ value: t.minutes, weight: t.weight })))), count: usable.length };
}

/** The value where half the weight is below and half above. */
export function weightedMedian(items: readonly { value: number; weight: number }[]): number {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, i) => sum + i.weight, 0);
  let running = 0;
  for (const item of sorted) {
    running += item.weight;
    if (running >= total / 2) return item.value;
  }
  return sorted.at(-1)?.value ?? 0;
}

/** Weighted least squares: minutes = setup + rate × quantity. Null if it can't be fitted or makes no sense. */
function fitLine(points: readonly { x: number; y: number; w: number }[]): { setup: number; rate: number } | null {
  const total = points.reduce((s, p) => s + p.w, 0);
  const mx = points.reduce((s, p) => s + p.w * p.x, 0) / total;
  const my = points.reduce((s, p) => s + p.w * p.y, 0) / total;
  const sxx = points.reduce((s, p) => s + p.w * (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const rate = points.reduce((s, p) => s + p.w * (p.x - mx) * (p.y - my), 0) / sxx;
  const setup = my - rate * mx;
  // Bigger batches never take less time; a negative setup means the data's too noisy to trust.
  if (rate < 0 || setup < 0) return null;
  return { setup, rate };
}

const round = (minutes: number) => Math.round(minutes);

/**
 * Shelf life and critical points (SPEC → Food safety; FS2, FS3; DECISIONS 52).
 * Pure. The app never invents a shelf life: it only reads the kitchen's own
 * rules. For critical points it shows the kitchen's targets, and where a
 * kitchen hasn't set one, the legal limit in England as a reminder to
 * check their HACCP or SFBB pack.
 */

import { normaliseStepText, readMinutes } from '../parser/tokens';

/**
 * A shelf life as the chef writes it: "3 days", "48 hrs", "5d", "1 week".
 * A bare number is days ("3" → 3 days): that's how kitchens say it.
 * Returns minutes, or null if it can't be read.
 */
export function readShelfLife(text: string): number | null {
  const t = normaliseStepText(text);
  if (!t) return null;
  const bare = t.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Number(bare[1]) * 1440;
  const weeks = t.match(/^(\d+(?:\.\d+)?)\s*(?:w|wk|wks|week|weeks)$/);
  if (weeks) return Number(weeks[1]) * 7 * 1440;
  const read = readMinutes(t).value;
  return read ? read.min : null;
}

/** Made at + shelf life: the use-by moment. */
export function useByFrom(madeAt: Date, shelfLifeMinutes: number): Date {
  return new Date(madeAt.getTime() + shelfLifeMinutes * 60_000);
}

export type CriticalKind = 'cooling' | 'hot-hold' | 'reheat';

/** England's legal limits (SPEC → Food safety). Shown only as a reminder when the kitchen hasn't set its own. */
export const LEGAL_LIMITS: Record<CriticalKind, string> = {
  cooling: 'chill to 8°C or below',
  'hot-hold': 'hold at 63°C or above',
  reheat: 'reheat until piping hot (75°C core is the usual check)',
};

export const CRITICAL_NAMES: Record<CriticalKind, string> = {
  cooling: 'Cooling',
  'hot-hold': 'Hot holding',
  reheat: 'Reheating',
};

/**
 * What a critical point should say on a step (FS3): "Cooling: below 5°C
 * within 90 min (kitchen target)", or the legal limit with a nudge to set it.
 */
export function criticalTarget(kind: string, kitchenTarget: string | null | undefined): { text: string; fromKitchen: boolean } | null {
  if (!(kind in LEGAL_LIMITS)) return null;
  const k = kind as CriticalKind;
  if (kitchenTarget?.trim()) return { text: `${CRITICAL_NAMES[k]}: ${kitchenTarget.trim()}`, fromKitchen: true };
  return { text: `${CRITICAL_NAMES[k]}: ${LEGAL_LIMITS[k]} (legal limit; check your kitchen's target)`, fromKitchen: false };
}

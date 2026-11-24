/**
 * Scaling (SPEC → Scaling). Phase 5 adds scaling by yield, portions and
 * anchor ingredient, with rounding to what can be weighed. Every method
 * comes down to this factor.
 */

/** Make 3 L from a 2 L recipe → 1.5. Never changes the stored recipe. */
export function scaleFactor(baseAmount: number, targetAmount: number): number {
  if (baseAmount <= 0) {
    throw new Error('The base amount must be more than zero');
  }
  return targetAmount / baseAmount;
}

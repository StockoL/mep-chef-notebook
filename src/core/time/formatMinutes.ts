/**
 * Shows a number of minutes the way a chef reads a time on the plan or a
 * countdown: short, and the same shape every time.
 *
 * Under an hour, minutes with "min":
 *    45 → "45 min"
 *     0 → "0 min"
 * An hour or more, hours with "h", then the minutes as two digits:
 *    90 → "1h 30"
 *    65 → "1h 05"
 *   120 → "2h"        (no " 00" on a whole hour)
 * Negative means overrun (prep mode counts into negative time). Use the
 * real minus sign "−" (U+2212), not a hyphen "-": it's the width of a digit,
 * so a countdown doesn't shift sideways as it passes zero.
 *    −6 → "−6 min"
 *   −90 → "−1h 30"
 *
 * Decide for yourself, and write a test for each:
 *  - what a fractional input such as 2.5 should give
 *  - anything else you think could reach this function
 */
export function formatMinutes(minutes: number): string {
  // TODO(Louis): write the tests in formatMinutes.test.ts first, watch them
  // fail, then replace this line with your implementation.
  throw new Error(`formatMinutes(${minutes}) is not written yet`);
}

/** The real minus sign (U+2212). It's the width of a digit, unlike a hyphen,
 *  so a countdown doesn't shift sideways as it passes zero. */
const MINUS = '−';

/**
 * Shows a number of minutes the way a chef reads a time on the plan or a
 * countdown: short, and the same shape every time.
 *
 *    45 → "45 min"      90 → "1h 30"      −6 → "−6 min"
 *     0 → "0 min"       65 → "1h 05"     −90 → "−1h 30"
 *                      120 → "2h"
 *
 * - Negative means overrun (prep mode counts into negative time).
 * - Fractions round to the nearest whole minute, by size, so 2.5 → "3 min"
 *   and −2.5 → "−3 min". Rounding happens first, so 59.6 → "1h".
 * - A tiny overrun that rounds to zero shows "0 min", never "−0 min".
 * - NaN or Infinity throws: it means a bug upstream, so fail loudly.
 */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) {
    throw new RangeError(`formatMinutes needs a finite number, got ${minutes}`);
  }

  // Work with the size and the sign separately. Math.round(-2.5) is -2 in
  // JavaScript (it rounds .5 towards +∞), so round the size instead.
  const total = Math.round(Math.abs(minutes));
  const sign = minutes < 0 && total > 0 ? MINUS : '';

  if (total < 60) {
    return `${sign}${total} min`;
  }

  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (rest === 0) {
    return `${sign}${hours}h`;
  }
  return `${sign}${hours}h ${String(rest).padStart(2, '0')}`;
}

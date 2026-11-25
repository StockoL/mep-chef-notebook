/**
 * Rounding a scaled amount to what can be weighed or measured
 * (SPEC → Scaling; DECISIONS 42), and showing it the way a chef reads it.
 *
 *   weight and volume   under 10: nearest 0.5 · under 100: nearest 1 ·
 *                       under 1000: nearest 5 · 1000 and over: kg / l, nearest 10 g or ml
 *   pints               nearest ¼
 *   tsp                 nearest ¼        tbsp   nearest ½
 *   each                under 5: nearest ½ · otherwise whole
 *   portions            whole
 *   pinch, sprig, …     under 3: nearest ½ · otherwise whole
 *
 * Nothing that was there rounds away to nothing: the smallest step is kept.
 */

import { isUnit, UNITS, type Unit } from '../units/units';

export interface Amount {
  amount: number;
  unit: Unit;
}

const nearest = (value: number, step: number) => Math.round(value / step) * step;
const atLeast = (value: number, step: number) => (value > 0 ? Math.max(step, nearest(value, step)) : 0);

/** Rounds an amount to what can be measured, moving g ↔ kg and ml ↔ l as it goes. */
export function roundForKitchen(amount: number, unit: Unit): Amount {
  if (unit === 'kg') return roundForKitchen(amount * 1000, 'g');
  if (unit === 'l') return roundForKitchen(amount * 1000, 'ml');

  if (unit === 'g' || unit === 'ml') {
    if (amount >= 1000) {
      return { amount: nearest(amount, 10) / 1000, unit: unit === 'g' ? 'kg' : 'l' };
    }
    if (amount >= 100) return { amount: nearest(amount, 5), unit };
    if (amount >= 10) return { amount: nearest(amount, 1), unit };
    return { amount: atLeast(amount, 0.5), unit };
  }
  if (unit === 'pint') return { amount: atLeast(amount, 0.25), unit };
  if (unit === 'tsp') return { amount: atLeast(amount, 0.25), unit };
  if (unit === 'tbsp') return { amount: atLeast(amount, 0.5), unit };
  if (unit === 'portion') return { amount: Math.max(1, Math.round(amount)), unit };
  if (unit === 'each') return { amount: amount < 5 ? atLeast(amount, 0.5) : Math.round(amount), unit };
  // Count words: pinch, sprig, bunch, clove…
  return { amount: amount < 3 ? atLeast(amount, 0.5) : Math.round(amount), unit };
}

const FRACTIONS: [number, string][] = [
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
];

/**
 * "1.25 kg" → "1.25kg", "0.5 each" → "½", "1.5 tsp" → "1½ tsp", "2 pinches".
 * Metric stays decimal; spoons and counts use ¼ ½ ¾.
 */
export function formatAmount(amount: number, unit: string): string {
  const metric = unit === 'g' || unit === 'kg' || unit === 'ml' || unit === 'l';
  if (metric) return `${Math.round(amount * 1000) / 1000}${unit}`;

  const whole = Math.floor(amount);
  const fraction = FRACTIONS.find(([value]) => Math.abs(amount - whole - value) < 0.01)?.[1];
  const number = fraction ? `${whole || ''}${fraction}` : String(Math.round(amount * 100) / 100);
  if (unit === 'each') return number;
  if (!isUnit(unit)) return `${number} ${unit}`;
  return `${number} ${amount > 1 ? UNITS[unit].plural : unit}`;
}

/**
 * Scaling (SPEC → Scaling; S1–S3; DECISIONS 41–43). Every method comes down
 * to one factor, applied to every line:
 * - by yield: "make 3 l" of a recipe that makes 2 l → ×1.5;
 * - from an anchor: "I've got 340 g butter" where the recipe says 250 g → ×1.36;
 * - by portions or people: a dish for 40 covers needs 40 × each component's
 *   amount per portion, and each component scales by yield to that.
 *
 * Units convert inside scaling: metric and pints within weight or volume,
 * and across them with the ingredient's density or the chef's own weights
 * ("my handful of parsley = 40 g"). Scaling never changes the stored recipe.
 * Pure: no database, no DOM.
 */

import { convert, UNITS, isUnit, type Unit } from '../units/units';
import { formatAmount, roundForKitchen, type Amount } from './rounding';

/** Make 3 L from a 2 L recipe → 1.5. Never changes the stored recipe. */
export function scaleFactor(baseAmount: number, targetAmount: number): number {
  if (baseAmount <= 0) {
    throw new Error('The base amount must be more than zero');
  }
  return targetAmount / baseAmount;
}

/** What's known about one ingredient's weight, for converting across kinds of measure. */
export interface Weights {
  /** Grams per millilitre. */
  density?: number | null;
  /** The chef's own: grams in one of a count unit ("handful": 40, "each": 55). */
  unitWeights?: Partial<Record<string, number>>;
}

/** An amount in grams, if it can be worked out: weight directly, volume by density, counts by the chef's weights. */
export function toGrams(amount: number, unit: string, weights: Weights = {}): number | null {
  if (!isUnit(unit)) return null;
  const dimension = UNITS[unit].dimension;
  if (dimension === 'mass') return convert(amount, unit, 'g');
  if (dimension === 'volume') return weights.density ? convert(amount, unit, 'ml') * weights.density : null;
  const each = weights.unitWeights?.[unit];
  return each ? amount * each : null;
}

/**
 * `amount` of `from` expressed in `to`: 1 pint → 568 ml; with a density,
 * 500 ml cream → 505 g; with the chef's weights, 3 handfuls → 120 g.
 * null when there's no way across.
 */
export function convertAmount(amount: number, from: string, to: string, weights: Weights = {}): number | null {
  if (!isUnit(from) || !isUnit(to)) return from === to ? amount : null;
  if (UNITS[from].dimension === UNITS[to].dimension) return convert(amount, from, to);
  const grams = toGrams(amount, from, weights);
  const gramsInOne = toGrams(1, to, weights);
  return grams !== null && gramsInOne ? grams / gramsInOne : null;
}

/** By yield (S1): make `target` of a recipe that makes `base`. null if they can't be compared. */
export function yieldFactor(base: { amount: number; unit: string }, target: { amount: number; unit: string }): number | null {
  if (base.amount <= 0) return null;
  const inBaseUnit = convertAmount(target.amount, target.unit, base.unit);
  return inBaseUnit === null ? null : scaleFactor(base.amount, inBaseUnit);
}

/**
 * From an anchor (S2): the recipe's line says `line`; the chef has `have`.
 * Uses the ingredient's weights when the two are different kinds of measure.
 */
export function anchorFactor(line: { amount: number; unit: string }, have: { amount: number; unit: string }, weights: Weights = {}): number | null {
  if (line.amount <= 0) return null;
  const inLineUnit = convertAmount(have.amount, have.unit, line.unit, weights);
  return inLineUnit === null ? null : scaleFactor(line.amount, inLineUnit);
}

/** By portions or people (S1, S3): how much of a component `portions` servings need. */
export function amountForPortions(perPortion: { amount: number; unit: string }, portions: number): { amount: number; unit: string } {
  return { amount: perPortion.amount * portions, unit: perPortion.unit };
}

// ─── One line, scaled ─────────────────────────────────────────────────────

export interface ScaledAmount extends Amount {
  /** "1¼ tsp", "120g": a rough measure turned into something you can weigh (DECISIONS 41). */
  estimate: string | null;
}

/** Rough measures and their size in teaspoons (DECISIONS 41). */
const ROUGH_TSP: Partial<Record<Unit, number>> = {
  smidgen: 1 / 32,
  pinch: 1 / 8,
  dash: 1 / 8,
  splash: 1,
  glug: 6,
  dollop: 3,
};

/** Scales one line and rounds it to what can be measured. */
export function scaleAmount(amount: number, unit: string, factor: number, weights: Weights = {}): ScaledAmount | null {
  if (!isUnit(unit)) return null;
  const scaled = amount * factor;
  const rounded = roundForKitchen(scaled, unit);
  return { ...rounded, estimate: factor === 1 ? null : estimate(scaled, unit, weights) };
}

/**
 * A rough measure in something you can measure: the chef's own weight
 * first ("knob of butter" = 15 g), then the fixed spoon table for pinches,
 * dashes, splashes, glugs and dollops. Only for amounts worth measuring:
 * a scaled "1 pinch" stays a pinch.
 */
export function estimate(amount: number, unit: Unit, weights: Weights = {}): string | null {
  const metric = UNITS[unit].dimension === 'mass' || UNITS[unit].dimension === 'volume';
  if (metric) return null;
  const each = weights.unitWeights?.[unit];
  if (each) {
    const grams = roundForKitchen(amount * each, 'g');
    return formatAmount(grams.amount, grams.unit);
  }
  const tsp = ROUGH_TSP[unit];
  if (!tsp || amount < 2) return null;
  const total = amount * tsp;
  if (total < 0.25) return null;
  if (total < 3) return formatAmount(roundForKitchen(total, 'tsp').amount, 'tsp');
  if (total < 12) return formatAmount(roundForKitchen(total / 3, 'tbsp').amount, 'tbsp');
  const ml = roundForKitchen(total * 5, 'ml');
  return formatAmount(ml.amount, ml.unit);
}

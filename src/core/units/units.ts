/**
 * Units of measure. Fixed by the app (DECISIONS 16, 34). Phase 5 adds density
 * for volume ↔ weight and rounding; for now, metric converts within one kind
 * of measure, and kitchen count words (sprig, bunch…) don't convert at all.
 */
export const UNITS = {
  g: { dimension: 'mass', perBase: 1, plural: 'g' },
  kg: { dimension: 'mass', perBase: 1000, plural: 'kg' },
  ml: { dimension: 'volume', perBase: 1, plural: 'ml' },
  l: { dimension: 'volume', perBase: 1000, plural: 'l' },
  each: { dimension: 'count', perBase: 1, plural: 'each' },
  portion: { dimension: 'portion', perBase: 1, plural: 'portions' },
  tsp: { dimension: 'tsp', perBase: 1, plural: 'tsp' },
  tbsp: { dimension: 'tbsp', perBase: 1, plural: 'tbsp' },
  pinch: { dimension: 'pinch', perBase: 1, plural: 'pinches' },
  bunch: { dimension: 'bunch', perBase: 1, plural: 'bunches' },
  sprig: { dimension: 'sprig', perBase: 1, plural: 'sprigs' },
  clove: { dimension: 'clove', perBase: 1, plural: 'cloves' },
  slice: { dimension: 'slice', perBase: 1, plural: 'slices' },
  sheet: { dimension: 'sheet', perBase: 1, plural: 'sheets' },
  leaf: { dimension: 'leaf', perBase: 1, plural: 'leaves' },
  tin: { dimension: 'tin', perBase: 1, plural: 'tins' },
  pack: { dimension: 'pack', perBase: 1, plural: 'packs' },
} as const;

export type Unit = keyof typeof UNITS;

/** Units offered as chips for waste and yields: the common ones, not every count word. */
export const UNIT_CHOICES: Unit[] = ['g', 'kg', 'ml', 'l', 'each', 'portion'];

export function isUnit(value: string): value is Unit {
  return Object.hasOwn(UNITS, value);
}

/** 2 kg → 2000 g. Throws when the units measure different things (g → ml). */
export function convert(value: number, from: Unit, to: Unit): number {
  const source = UNITS[from];
  const target = UNITS[to];
  if (source.dimension !== target.dimension) {
    throw new Error(`Can't convert ${from} to ${to} without a density`);
  }
  return (value * source.perBase) / target.perBase;
}

/**
 * "2kg", "500ml", "3 each" → "3", "2 sprigs", "1 sprig". Metric symbols sit
 * against the number; words take a space and a plural.
 */
export function formatQuantity(amount: number, unit: string): string {
  const number = String(Math.round(amount * 1000) / 1000);
  if (!isUnit(unit)) return `${number} ${unit}`;
  if (unit === 'each') return number;
  if (unit === 'g' || unit === 'kg' || unit === 'ml' || unit === 'l') return `${number}${unit}`;
  return `${number} ${amount === 1 ? unit : UNITS[unit].plural}`;
}

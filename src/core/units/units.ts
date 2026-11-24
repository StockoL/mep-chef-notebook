/**
 * Units of measure. Fixed by the app (DECISIONS 16). Phase 5 settles the full
 * list, density for volume ↔ weight, and rounding; this stub covers metric
 * conversion within one kind of measure.
 */
export const UNITS = {
  g: { dimension: 'mass', perBase: 1 },
  kg: { dimension: 'mass', perBase: 1000 },
  ml: { dimension: 'volume', perBase: 1 },
  l: { dimension: 'volume', perBase: 1000 },
} as const;

export type Unit = keyof typeof UNITS;

/** 2 kg → 2000 g. Throws when the units measure different things (g → ml). */
export function convert(value: number, from: Unit, to: Unit): number {
  const source = UNITS[from];
  const target = UNITS[to];
  if (source.dimension !== target.dimension) {
    throw new Error(`Can't convert ${from} to ${to} without a density`);
  }
  return (value * source.perBase) / target.perBase;
}

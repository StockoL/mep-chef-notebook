/**
 * Names with where they're from written into them (DECISIONS 54).
 *
 * Chefs name dishes the way the menu does ("Steak", "Cornish sea bass"),
 * so two kitchens' dishes can share a name. Before Mep showed where a dish
 * is from, the only way to tell them apart was to write it into the name:
 * "Cornish sea bass (Dumbleton, 2026)". These helpers read that back out so
 * the name can be tidied and the kitchen recorded properly.
 */

export interface OriginSuffix {
  /** The name without the brackets: "Cornish sea bass". */
  name: string;
  /** What was written for the place: "Dumbleton". */
  place: string;
  /** The year, if one was written: 2026. */
  year: number | null;
}

// "(Dumbleton, 2026)", "(Dumbleton 2026)", "(Dumbleton)", "(Ellenborough Park, '25)" at the end.
const SUFFIX = /^(.*\S)\s*\(\s*([^()]*?[A-Za-z][^()]*?)(?:[\s,]+'?(\d{2}|\d{4}))?\s*\)\s*$/;

/** Splits "Cornish sea bass (Dumbleton, 2026)" into its parts; null when there's no such ending. */
export function splitOriginSuffix(fullName: string): OriginSuffix | null {
  const match = SUFFIX.exec(fullName.trim());
  if (!match) return null;
  const [, name, place, year] = match;
  if (!name || !place) return null;
  const yearNumber = year ? Number(year.length === 2 ? `20${year}` : year) : null;
  return { name: name.trim(), place: place.trim().replace(/,$/, '').trim(), year: yearNumber };
}

/**
 * The kitchen a written place means: "Dumbleton" → "Dumbleton Hall".
 * Matches the whole name or its first words, ignoring case and "the";
 * null when no kitchen (or more than one) fits.
 */
export function matchKitchen<T extends { name: string }>(place: string, kitchens: readonly T[]): T | null {
  const simplify = (text: string) =>
    text
      .toLowerCase()
      .replace(/^the\s+/, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const wanted = simplify(place);
  if (!wanted) return null;
  const exact = kitchens.filter((k) => simplify(k.name) === wanted);
  if (exact.length === 1) return exact[0]!;
  const starts = kitchens.filter((k) => `${simplify(k.name)} `.startsWith(`${wanted} `));
  return starts.length === 1 ? starts[0]! : null;
}

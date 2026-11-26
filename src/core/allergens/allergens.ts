/**
 * The 14 allergens UK law requires kitchens to declare.
 * Fixed by the app, not an editable list (DECISIONS 16): a kitchen can't
 * rename or hide one. Legal sub-types (which cereal, which tree nut) and
 * working allergens out through components are below.
 */
export const ALLERGENS = [
  { id: 'celery', label: 'Celery' },
  { id: 'cereals-gluten', label: 'Cereals containing gluten' },
  { id: 'crustaceans', label: 'Crustaceans' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'fish', label: 'Fish' },
  { id: 'lupin', label: 'Lupin' },
  { id: 'milk', label: 'Milk' },
  { id: 'molluscs', label: 'Molluscs' },
  { id: 'mustard', label: 'Mustard' },
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'sesame', label: 'Sesame' },
  { id: 'soya', label: 'Soya' },
  { id: 'sulphites', label: 'Sulphur dioxide and sulphites' },
  { id: 'tree-nuts', label: 'Tree nuts' },
] as const;

/** 'celery' | 'cereals-gluten' | … worked out from the list above. */
export type AllergenId = (typeof ALLERGENS)[number]['id'];

/** Is this string one of the 14? Useful when reading imported data. */
export function isAllergenId(value: string): value is AllergenId {
  return ALLERGENS.some((allergen) => allergen.id === value);
}

// ─── Sub-types (DECISIONS 52) ─────────────────────────────────────────────

/**
 * The legal sub-types a matrix needs: which cereal, which tree nut. Stored in
 * the same lists as the 14, as "allergen:sub-type" ("tree-nuts:hazelnut"),
 * so an ingredient can say "tree nuts" or exactly which.
 */
export const SUB_TYPES = {
  'cereals-gluten': [
    { id: 'wheat', label: 'wheat (incl. spelt, khorasan)' },
    { id: 'rye', label: 'rye' },
    { id: 'barley', label: 'barley' },
    { id: 'oats', label: 'oats' },
  ],
  'tree-nuts': [
    { id: 'almond', label: 'almond' },
    { id: 'hazelnut', label: 'hazelnut' },
    { id: 'walnut', label: 'walnut' },
    { id: 'cashew', label: 'cashew' },
    { id: 'pecan', label: 'pecan' },
    { id: 'brazil', label: 'Brazil nut' },
    { id: 'pistachio', label: 'pistachio' },
    { id: 'macadamia', label: 'macadamia (Queensland nut)' },
  ],
} as const satisfies Partial<Record<AllergenId, readonly { id: string; label: string }[]>>;

/** One of the 14, or one of their sub-types: "mustard", "tree-nuts:hazelnut". */
export type AllergenCode = AllergenId | `${AllergenId}:${string}`;

/** The allergen a code belongs to: "tree-nuts:hazelnut" → "tree-nuts". */
export function baseAllergen(code: string): AllergenId | null {
  const base = code.split(':')[0] ?? '';
  return isAllergenId(base) ? base : null;
}

/** Is this one of the 14, or a known sub-type of one? */
export function isAllergenCode(code: string): code is AllergenCode {
  const base = baseAllergen(code);
  if (!base) return false;
  const sub = code.split(':')[1];
  if (sub === undefined) return true;
  const subs: readonly { id: string }[] = (SUB_TYPES as Partial<Record<AllergenId, readonly { id: string }[]>>)[base] ?? [];
  return subs.some((s) => s.id === sub);
}

/** "Tree nuts (hazelnut)" for a code; the allergen's name for one of the 14. */
export function allergenLabel(code: string): string {
  const base = baseAllergen(code);
  const name = ALLERGENS.find((a) => a.id === base)?.label ?? code;
  const sub = code.split(':')[1];
  if (!sub || !base) return name;
  const subs: readonly { id: string; label: string }[] = (SUB_TYPES as Partial<Record<AllergenId, readonly { id: string; label: string }[]>>)[base] ?? [];
  return `${name} (${subs.find((s) => s.id === sub)?.label ?? sub})`;
}

// ─── Gathering through components (FS1) ───────────────────────────────────

/** One ingredient's contribution, found by walking a recipe's lines and the components it uses. */
export interface AllergenSource {
  /** "Butter". */
  ingredient: string;
  /** Components it came through, outermost first: ["Tartare", "Mayonnaise"]. */
  via: string[];
  contains: readonly string[];
  mayContain: readonly string[];
  /** A bought-in ingredient with no product chosen: its allergens aren't known (FS5). */
  unconfirmed: boolean;
}

export interface AllergenFinding {
  /** One of the 14. */
  allergen: AllergenId;
  label: string;
  /** Which sub-types are named: "hazelnut". */
  subTypes: string[];
  /** "Butter (via Beurre blanc)". */
  from: string[];
}

export interface AllergenSummary {
  contains: AllergenFinding[];
  /** May contain, and not already in contains. */
  mayContain: AllergenFinding[];
  /** "Mayonnaise (via Tartare)": no product chosen, so not confirmed. */
  unconfirmed: string[];
  /**
   * Parts with no ingredients recorded, named as sources are ("Garnish (via
   * Cod)"): their allergens aren't known, so the whole isn't either.
   */
  unrecorded: string[];
  /** No ingredients recorded anywhere: nothing is known yet. */
  empty: boolean;
  /**
   * Complete only when there is at least one ingredient, every part has
   * ingredients, and every line is confirmed. Never vacuously true.
   */
  complete: boolean;
}

const sourceName = (s: AllergenSource) => (s.via.length ? `${s.ingredient} (via ${s.via.join(' → ')})` : s.ingredient);

function findings(sources: readonly AllergenSource[], pick: (s: AllergenSource) => readonly string[]): AllergenFinding[] {
  const found = new Map<AllergenId, { subs: Set<string>; from: Set<string> }>();
  for (const source of sources) {
    for (const code of pick(source)) {
      const base = baseAllergen(code);
      if (!base) continue;
      const entry = found.get(base) ?? { subs: new Set(), from: new Set() };
      const sub = code.split(':')[1];
      if (sub) entry.subs.add(allergenLabel(code).replace(/^.*\((.*)\)$/, '$1'));
      entry.from.add(sourceName(source));
      found.set(base, entry);
    }
  }
  // In the order of the legal list.
  return ALLERGENS.filter((a) => found.has(a.id)).map((a) => ({
    allergen: a.id,
    label: a.label,
    subTypes: [...found.get(a.id)!.subs],
    from: [...found.get(a.id)!.from],
  }));
}

/**
 * What a recipe contains, may contain, and what isn't confirmed (FS1, FS5).
 * Never "allergen-free" while anything is unconfirmed or unrecorded:
 * `complete` says so. `unrecorded` names the parts with no ingredients.
 */
export function summariseAllergens(sources: readonly AllergenSource[], unrecorded: readonly string[] = []): AllergenSummary {
  const contains = findings(sources, (s) => s.contains);
  const known = new Set(contains.map((c) => c.allergen));
  const empty = sources.length === 0;
  return {
    contains,
    mayContain: findings(sources, (s) => s.mayContain).filter((m) => !known.has(m.allergen)),
    unconfirmed: [...new Set(sources.filter((s) => s.unconfirmed).map(sourceName))],
    unrecorded: [...new Set(unrecorded)],
    empty,
    complete: !empty && unrecorded.length === 0 && sources.every((s) => !s.unconfirmed),
  };
}

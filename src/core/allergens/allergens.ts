/**
 * The 14 allergens UK law requires kitchens to declare.
 * Fixed by the app, not an editable list (DECISIONS 16): a kitchen can't
 * rename or hide one. Legal sub-types (which cereal, which tree nut) and
 * working allergens out through components arrive in Phase 10.
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

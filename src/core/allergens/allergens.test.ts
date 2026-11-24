import { describe, expect, it } from 'vitest';
import { ALLERGENS, isAllergenId } from './allergens';

describe('ALLERGENS', () => {
  it('lists the 14 UK allergens, each once', () => {
    const ids = ALLERGENS.map((allergen) => allergen.id);
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
  });

  it('recognises allergen ids and rejects anything else', () => {
    expect(isAllergenId('mustard')).toBe(true);
    expect(isAllergenId('garlic')).toBe(false);
  });
});

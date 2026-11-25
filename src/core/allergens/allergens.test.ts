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

describe('sub-types', () => {
  it('reads and names allergen codes with sub-types', async () => {
    const { allergenLabel, baseAllergen, isAllergenCode } = await import('./allergens');
    expect(isAllergenCode('tree-nuts:hazelnut')).toBe(true);
    expect(isAllergenCode('tree-nuts:peanut')).toBe(false);
    expect(isAllergenCode('mustard:english')).toBe(false);
    expect(baseAllergen('cereals-gluten:oats')).toBe('cereals-gluten');
    expect(allergenLabel('tree-nuts:hazelnut')).toBe('Tree nuts (hazelnut)');
    expect(allergenLabel('milk')).toBe('Milk');
  });
});

describe('gathering allergens through components (FS1, FS5)', () => {
  it('says where each comes from, keeps may-contain apart, and is never complete while anything is unconfirmed', async () => {
    const { summariseAllergens } = await import('./allergens');
    const summary = summariseAllergens([
      { ingredient: 'Butter', via: ['Beurre blanc'], contains: ['milk'], mayContain: [], unconfirmed: false },
      { ingredient: 'Hazelnuts', via: [], contains: ['tree-nuts:hazelnut'], mayContain: [], unconfirmed: false },
      { ingredient: 'Dijon', via: ['Rémoulade'], contains: ['mustard'], mayContain: ['milk', 'sesame'], unconfirmed: false },
      { ingredient: 'Mayonnaise', via: ['Rémoulade'], contains: [], mayContain: [], unconfirmed: true },
    ]);
    expect(summary.contains.map((c) => [c.label, c.subTypes, c.from])).toEqual([
      ['Milk', [], ['Butter (via Beurre blanc)']],
      ['Mustard', [], ['Dijon (via Rémoulade)']],
      ['Tree nuts', ['hazelnut'], ['Hazelnuts']],
    ]);
    // Milk is already "contains", so only sesame is "may contain".
    expect(summary.mayContain.map((m) => m.label)).toEqual(['Sesame']);
    expect(summary.unconfirmed).toEqual(['Mayonnaise (via Rémoulade)']);
    expect(summary.complete).toBe(false);
  });
});

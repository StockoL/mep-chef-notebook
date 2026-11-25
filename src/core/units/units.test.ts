import { describe, expect, it } from 'vitest';
import { convert, formatQuantity } from './units';

describe('convert', () => {
  it('converts within one kind of measure', () => {
    expect(convert(2, 'kg', 'g')).toBe(2000);
    expect(convert(750, 'ml', 'l')).toBe(0.75);
  });

  it('refuses weight to volume without a density', () => {
    expect(() => convert(100, 'g', 'ml')).toThrow(/density/);
  });
});

describe('pints', () => {
  it('measure 568 ml', () => {
    expect(convert(1, 'pint', 'ml')).toBe(568);
    expect(formatQuantity(1, 'pint')).toBe('1 pint');
    expect(formatQuantity(2, 'pint')).toBe('2 pints');
  });
});

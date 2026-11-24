import { describe, expect, it } from 'vitest';
import { convert } from './units';

describe('convert', () => {
  it('converts within one kind of measure', () => {
    expect(convert(2, 'kg', 'g')).toBe(2000);
    expect(convert(750, 'ml', 'l')).toBe(0.75);
  });

  it('refuses weight to volume without a density', () => {
    expect(() => convert(100, 'g', 'ml')).toThrow(/density/);
  });
});

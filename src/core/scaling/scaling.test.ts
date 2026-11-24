import { describe, expect, it } from 'vitest';
import { scaleFactor } from './scaling';

describe('scaleFactor', () => {
  it('works out how much to multiply by', () => {
    expect(scaleFactor(2, 3)).toBe(1.5);
    expect(scaleFactor(500, 250)).toBe(0.5);
  });

  it('refuses a base of zero', () => {
    expect(() => scaleFactor(0, 3)).toThrow();
  });
});

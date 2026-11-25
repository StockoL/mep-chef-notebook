import { describe, expect, it } from 'vitest';
import { criticalTarget, readShelfLife, useByFrom } from './foodSafety';

describe('shelf life (FS2)', () => {
  it('reads a shelf life as kitchens write it', () => {
    expect(readShelfLife('3 days')).toBe(3 * 1440);
    expect(readShelfLife('3')).toBe(3 * 1440);
    expect(readShelfLife('48 hrs')).toBe(48 * 60);
    expect(readShelfLife('5d')).toBe(5 * 1440);
    expect(readShelfLife('1 week')).toBe(7 * 1440);
    expect(readShelfLife('until it smells')).toBeNull();
  });

  it('works out the use-by', () => {
    expect(useByFrom(new Date(2026, 10, 25, 10, 30), 3 * 1440)).toEqual(new Date(2026, 10, 28, 10, 30));
  });
});

describe('critical points (FS3)', () => {
  it('shows the kitchen’s own target', () => {
    expect(criticalTarget('cooling', 'below 5°C within 90 min')).toEqual({ text: 'Cooling: below 5°C within 90 min', fromKitchen: true });
  });

  it('falls back to the legal limit as a reminder, never as the kitchen’s rule', () => {
    expect(criticalTarget('hot-hold', null)).toEqual({ text: 'Hot holding: hold at 63°C or above (legal limit; check your kitchen\'s target)', fromKitchen: false });
    expect(criticalTarget('something', 'x')).toBeNull();
  });
});

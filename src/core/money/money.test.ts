import { describe, expect, it } from 'vitest';
import { formatPrice, parsePrice } from './money';

describe('prices', () => {
  it('reads what a chef types', () => {
    expect(parsePrice('£12.50')).toBe(1250);
    expect(parsePrice('39')).toBe(3900);
    expect(parsePrice('12.5')).toBe(1250);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('free')).toBeNull();
  });
  it('shows whole pounds without pence', () => {
    expect(formatPrice(3900)).toBe('£39');
    expect(formatPrice(1250)).toBe('£12.50');
  });
});

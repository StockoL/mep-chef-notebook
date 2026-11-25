import { describe, expect, it } from 'vitest';
import { formatAmount, roundForKitchen } from './rounding';
import { amountForPortions, anchorFactor, convertAmount, estimate, scaleAmount, scaleFactor, yieldFactor } from './scaling';

describe('scaleFactor', () => {
  it('works out how much to multiply by', () => {
    expect(scaleFactor(2, 3)).toBe(1.5);
    expect(scaleFactor(500, 250)).toBe(0.5);
  });

  it('refuses a base of zero', () => {
    expect(() => scaleFactor(0, 3)).toThrow();
  });
});

describe('by yield (S1)', () => {
  it('scales to a target in the same or another unit of the same kind', () => {
    expect(yieldFactor({ amount: 2, unit: 'l' }, { amount: 3, unit: 'l' })).toBe(1.5);
    expect(yieldFactor({ amount: 2, unit: 'l' }, { amount: 500, unit: 'ml' })).toBe(0.25);
    expect(yieldFactor({ amount: 10, unit: 'portion' }, { amount: 40, unit: 'portion' })).toBe(4);
  });
  it('refuses what can’t be compared', () => {
    expect(yieldFactor({ amount: 2, unit: 'l' }, { amount: 3, unit: 'kg' })).toBeNull();
  });
});

describe('from an anchor (S2)', () => {
  it('scales from what you’ve got', () => {
    expect(anchorFactor({ amount: 250, unit: 'g' }, { amount: 340, unit: 'g' })).toBeCloseTo(1.36);
    expect(anchorFactor({ amount: 1, unit: 'kg' }, { amount: 750, unit: 'g' })).toBe(0.75);
  });
  it('crosses weight and volume with a density', () => {
    expect(anchorFactor({ amount: 400, unit: 'g' }, { amount: 500, unit: 'ml' })).toBeNull();
    expect(anchorFactor({ amount: 400, unit: 'g' }, { amount: 500, unit: 'ml' }, { density: 1.01 })).toBeCloseTo(1.2625);
  });
  it('uses the chef’s own weights for counts', () => {
    // 6 eggs in the recipe; 4 eggs' worth (220 g) in the fridge.
    expect(anchorFactor({ amount: 6, unit: 'each' }, { amount: 220, unit: 'g' }, { unitWeights: { each: 55 } })).toBeCloseTo(4 / 6);
  });
});

describe('by portions or people (S1, S3)', () => {
  it('multiplies the amount per portion', () => {
    expect(amountForPortions({ amount: 30, unit: 'ml' }, 40)).toEqual({ amount: 1200, unit: 'ml' });
  });
});

describe('converting', () => {
  it('measures pints as 568 ml', () => {
    expect(convertAmount(2, 'pint', 'l')).toBeCloseTo(1.136);
  });
});

describe('rounding to what can be weighed', () => {
  it('rounds weight and volume by size, moving to kg and l', () => {
    expect(roundForKitchen(3.27, 'g')).toEqual({ amount: 3.5, unit: 'g' });
    expect(roundForKitchen(0.1, 'g')).toEqual({ amount: 0.5, unit: 'g' });
    expect(roundForKitchen(47.4, 'g')).toEqual({ amount: 47, unit: 'g' });
    expect(roundForKitchen(342, 'g')).toEqual({ amount: 340, unit: 'g' });
    expect(roundForKitchen(1234, 'ml')).toEqual({ amount: 1.23, unit: 'l' });
    expect(roundForKitchen(0.3, 'kg')).toEqual({ amount: 300, unit: 'g' });
  });
  it('rounds spoons, counts, pints and portions', () => {
    expect(roundForKitchen(1.4, 'tsp')).toEqual({ amount: 1.5, unit: 'tsp' });
    expect(roundForKitchen(2.2, 'tbsp')).toEqual({ amount: 2, unit: 'tbsp' });
    expect(roundForKitchen(2.3, 'each')).toEqual({ amount: 2.5, unit: 'each' });
    expect(roundForKitchen(7.4, 'each')).toEqual({ amount: 7, unit: 'each' });
    expect(roundForKitchen(0.2, 'pinch')).toEqual({ amount: 0.5, unit: 'pinch' });
    expect(roundForKitchen(1.6, 'pint')).toEqual({ amount: 1.5, unit: 'pint' });
    expect(roundForKitchen(39.6, 'portion')).toEqual({ amount: 40, unit: 'portion' });
  });
  it('shows fractions for spoons and counts, decimals for metric', () => {
    expect(formatAmount(1.25, 'kg')).toBe('1.25kg');
    expect(formatAmount(0.5, 'each')).toBe('½');
    expect(formatAmount(1.5, 'tsp')).toBe('1½ tsp');
    expect(formatAmount(2, 'pinch')).toBe('2 pinches');
    expect(formatAmount(1, 'pint')).toBe('1 pint');
  });
});

describe('scaling a line', () => {
  it('scales and rounds', () => {
    expect(scaleAmount(250, 'g', 1.36)).toEqual({ amount: 340, unit: 'g', estimate: null });
    expect(scaleAmount(600, 'g', 2)).toEqual({ amount: 1.2, unit: 'kg', estimate: null });
  });
  it('gives rough measures an estimate once there are enough of them (DECISIONS 41)', () => {
    expect(scaleAmount(1, 'pinch', 10)).toEqual({ amount: 10, unit: 'pinch', estimate: '1¼ tsp' });
    expect(scaleAmount(1, 'pinch', 1.5)?.estimate).toBeNull();
    expect(estimate(3, 'dollop')).toBe('3 tbsp');
    expect(estimate(4, 'dollop')).toBe('60ml');
    expect(estimate(10, 'glug')).toBe('300ml');
  });
  it('uses the chef’s weight for a knob or handful, and has no fixed one', () => {
    expect(estimate(3, 'handful')).toBeNull();
    expect(scaleAmount(1, 'handful', 3, { unitWeights: { handful: 40 } })?.estimate).toBe('120g');
  });
  it('gives no estimate at the recipe’s own size', () => {
    expect(scaleAmount(3, 'knob', 1, { unitWeights: { knob: 15 } })?.estimate).toBeNull();
  });
});

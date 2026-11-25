import { describe, expect, it } from 'vitest';
import { packsToOrder, shortOfPar, stockValue, suggestPar } from '../stock/stock';
import { costPerUnit, formatPence, grossProfitPercent, lineCost } from './costing';

describe('costing (A1)', () => {
  it('costs a line as its share of the pack, across units', () => {
    // Butter £8.50 for 2 kg; 250 g → £1.0625.
    expect(lineCost(250, 'g', { amount: 2, unit: 'kg', price: 850 })).toBeCloseTo(106.25);
    // Milk £1.20 a pint (568 ml); 500 ml.
    expect(lineCost(500, 'ml', { amount: 1, unit: 'pint', price: 120 })).toBeCloseTo(105.63, 1);
    // Eggs £3.60 for 12; 3 eggs.
    expect(lineCost(3, 'each', { amount: 12, unit: 'each', price: 360 })).toBe(90);
  });

  it('grosses up for yield loss', () => {
    // Carrots £1 a kg, 20% lost to peeling: 1 kg needed costs £1.25.
    expect(lineCost(1, 'kg', { amount: 1, unit: 'kg', price: 100 }, {}, 20)).toBeCloseTo(125);
  });

  it('can’t cost what can’t be compared, or has no price', () => {
    expect(lineCost(1, 'bunch', { amount: 1, unit: 'kg', price: 100 })).toBeNull();
    expect(lineCost(1, 'kg', null)).toBeNull();
    // …unless the chef has said what a bunch weighs.
    expect(lineCost(1, 'bunch', { amount: 1, unit: 'kg', price: 1000 }, { unitWeights: { bunch: 100 } })).toBeCloseTo(100);
  });

  it('works GP from the price without VAT', () => {
    // £20 on the menu is £16.67 without VAT; £5 cost → 70% GP.
    expect(grossProfitPercent(2000, 500)).toBe(70);
    expect(grossProfitPercent(null, 500)).toBeNull();
    expect(costPerUnit(1200, 3)).toBe(400);
    expect(formatPence(427.4)).toBe('£4.27');
  });
});

describe('pars, counts and orders (A2, A3)', () => {
  it('works out what’s short of par, in the par’s unit', () => {
    expect(shortOfPar({ par: { amount: 2, unit: 'l' }, count: { amount: 500, unit: 'ml' } })).toBe(1.5);
    expect(shortOfPar({ par: { amount: 2, unit: 'l' }, count: { amount: 3, unit: 'l' } })).toBe(0);
    expect(shortOfPar({ par: null, count: { amount: 1, unit: 'l' } })).toBeNull();
  });

  it('orders whole packs', () => {
    expect(packsToOrder({ amount: 3.2, unit: 'kg' }, { amount: 2.5, unit: 'kg' })).toBe(2);
    expect(packsToOrder({ amount: 5, unit: 'kg' }, { amount: 2.5, unit: 'kg' })).toBe(2);
    expect(packsToOrder({ amount: 0, unit: 'kg' }, { amount: 2.5, unit: 'kg' })).toBe(0);
    expect(packsToOrder({ amount: 1, unit: 'kg' }, null)).toBeNull();
  });

  it('values stock and says what it couldn’t cost', () => {
    expect(stockValue([
      { name: 'Butter', count: 2, unitCost: 425 },
      { name: 'Chives', count: 3, unitCost: null },
      { name: 'Cream', count: 0, unitCost: null },
    ])).toEqual({ pence: 850, uncosted: ['Chives'] });
  });

  it('suggests a par only from a pattern, with the reason', () => {
    expect(suggestPar(4, 3, 0)).toEqual({ par: 5, reason: 'Short at 3 of your recent counts.' });
    expect(suggestPar(5, 0, 2)).toEqual({ par: 4, reason: 'Wasted as over-prep 2 times lately.' });
    expect(suggestPar(5, 1, 1)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { daysLabel, servedAt, servedLabel } from './served';

describe('when a menu is served', () => {
  const sundayLunch = { days: [7], serviceIds: ['lunch'] };
  const everyDay = { days: [], serviceIds: [] };

  it('knows a Sunday lunch menu from an every-day one', () => {
    expect(servedAt(sundayLunch, 7)).toBe(true);
    expect(servedAt(sundayLunch, 7, 'lunch')).toBe(true);
    expect(servedAt(sundayLunch, 7, 'dinner')).toBe(false);
    expect(servedAt(sundayLunch, 3)).toBe(false);
    expect(servedAt(everyDay, 3, 'dinner')).toBe(true);
  });

  it('says it the way a kitchen does', () => {
    const names = new Map([['lunch', 'Lunch'], ['dinner', 'Dinner']]);
    expect(servedLabel(sundayLunch, names)).toBe('Sundays · Lunch');
    expect(servedLabel(everyDay, names)).toBe('Every day');
    expect(servedLabel({ days: [], serviceIds: ['dinner'] }, names)).toBe('Dinner');
    expect(daysLabel([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    expect(daysLabel([6, 7])).toBe('Sat and Sun');
    expect(daysLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(daysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { formatSheetText, nextShiftDate, sheetProgress, sortSheetItems } from './sheet';

describe('sortSheetItems', () => {
  it('keeps unticked items in order and settles ticked ones to the bottom', () => {
    const items = [
      { id: 'a', done: true, order: 0 },
      { id: 'b', done: false, order: 2 },
      { id: 'c', done: false, order: 1 },
      { id: 'd', done: true, order: 3 },
    ];
    expect(sortSheetItems(items).map((i) => i.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('sheetProgress', () => {
  it('counts done and total', () => {
    expect(sheetProgress([{ done: true }, { done: false }, { done: true }])).toEqual({ done: 2, total: 3 });
  });
});

describe('nextShiftDate', () => {
  const tuesday = new Date(2026, 10, 24);
  it('finds the next day a shift falls on', () => {
    expect(nextShiftDate(tuesday, [1, 2, 3, 4, 5]).getDate()).toBe(25); // Wednesday
    expect(nextShiftDate(new Date(2026, 10, 27), [1, 2, 3, 4, 5]).getDate()).toBe(30); // Friday → Monday
  });

  it('is tomorrow when no shifts are set', () => {
    expect(nextShiftDate(tuesday, []).getDate()).toBe(25);
  });
});

describe('formatSheetText', () => {
  it('groups by service, any-time items first, with ticks', () => {
    const text = formatSheetText('Fish · Wed 26 Nov', [
      { label: 'Trout portions 12', done: false, service: 'Lunch' },
      { label: 'Beurre blanc 2l', done: true, service: null },
      { label: 'Chive oil: top up to 500ml', done: false, service: null },
    ]);
    expect(text).toBe(
      ['Fish · Wed 26 Nov', '☑ Beurre blanc 2l', '☐ Chive oil: top up to 500ml', '', 'Lunch', '☐ Trout portions 12'].join('\n'),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { daysBetween, isoDayOfWeek, isoWeek, previousIsoWeek, timeToMinutes, toCalendarDate } from './calendar';

describe('toCalendarDate', () => {
  it('uses the local date', () => {
    expect(toCalendarDate(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
  });
});

describe('isoDayOfWeek', () => {
  it('counts Monday as 1 and Sunday as 7', () => {
    expect(isoDayOfWeek(new Date(2026, 10, 23))).toBe(1); // Monday
    expect(isoDayOfWeek(new Date(2026, 10, 29))).toBe(7); // Sunday
  });
});

describe('timeToMinutes', () => {
  it('turns HH:MM into minutes since midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('12:30')).toBe(750);
    expect(timeToMinutes('9:05')).toBe(545);
  });

  it('refuses anything else', () => {
    expect(() => timeToMinutes('noon')).toThrow();
  });
});

describe('isoWeek', () => {
  it('numbers weeks from Monday', () => {
    expect(isoWeek(new Date(2026, 10, 23))).toBe('2026-W48'); // Monday
    expect(isoWeek(new Date(2026, 10, 29))).toBe('2026-W48'); // Sunday, same week
    expect(isoWeek(new Date(2026, 10, 30))).toBe('2026-W49'); // next Monday
  });

  it('puts early January in the previous year when the week started there', () => {
    expect(isoWeek(new Date(2027, 0, 1))).toBe('2026-W53'); // Friday 1 Jan 2027
    expect(isoWeek(new Date(2026, 0, 1))).toBe('2026-W01'); // Thursday 1 Jan 2026
  });

  it('finds the week before', () => {
    expect(previousIsoWeek(new Date(2026, 10, 23))).toBe('2026-W47');
    expect(previousIsoWeek(new Date(2026, 0, 5))).toBe('2026-W01'); // Mon 5 Jan 2026 is in W02
    expect(previousIsoWeek(new Date(2026, 0, 1))).toBe('2025-W52'); // across the year
  });
});

describe('daysBetween', () => {
  it('counts whole days, rounding down', () => {
    expect(daysBetween(new Date(2026, 10, 20, 9), new Date(2026, 10, 23, 8))).toBe(2);
    expect(daysBetween(new Date(2026, 10, 20, 9), new Date(2026, 10, 23, 10))).toBe(3);
  });
});

describe('minutesToTime', () => {
  it('shows minutes past midnight as a clock time', async () => {
    const { minutesToTime } = await import('./calendar');
    expect(minutesToTime(605)).toBe('10:05');
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(1450)).toBe('00:10');
  });
});

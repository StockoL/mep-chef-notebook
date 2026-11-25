import { describe, expect, it } from 'vitest';
import { formatMinuteRange, formatMinutes } from './formatMinutes';

describe('formatMinutes', () => {
  describe('under an hour', () => {
    it('shows minutes with "min"', () => {
      expect(formatMinutes(45)).toBe('45 min');
    });

    it('shows zero as "0 min"', () => {
      expect(formatMinutes(0)).toBe('0 min');
    });

    it('shows a single minute without padding', () => {
      expect(formatMinutes(5)).toBe('5 min');
    });
  });

  describe('an hour or more', () => {
    it('shows an hour and a half as "1h 30"', () => {
      expect(formatMinutes(90)).toBe('1h 30');
    });

    it('pads the minutes to two digits', () => {
      expect(formatMinutes(65)).toBe('1h 05');
    });

    it('leaves the minutes off a whole hour', () => {
      expect(formatMinutes(120)).toBe('2h');
    });

    it('switches to hours at exactly 60', () => {
      expect(formatMinutes(60)).toBe('1h');
    });

    it('keeps counting hours past a day (an overnight cure)', () => {
      expect(formatMinutes(1500)).toBe('25h');
    });
  });

  describe('overruns (negative)', () => {
    it('uses a real minus sign, not a hyphen', () => {
      expect(formatMinutes(-6)).toBe('−6 min');
    });

    it('formats hours the same way', () => {
      expect(formatMinutes(-90)).toBe('−1h 30');
    });
  });

  describe('fractions are rounded to the nearest minute', () => {
    it('rounds 2.5 up to 3', () => {
      expect(formatMinutes(2.5)).toBe('3 min');
    });

    it('rounds an overrun by its size, so −2.5 becomes −3', () => {
      expect(formatMinutes(-2.5)).toBe('−3 min');
    });

    it('rounds before splitting into hours, so 59.6 is "1h", not "60 min"', () => {
      expect(formatMinutes(59.6)).toBe('1h');
    });

    it('never shows "−0 min" for a tiny overrun', () => {
      expect(formatMinutes(-0.4)).toBe('0 min');
      expect(formatMinutes(-0)).toBe('0 min');
    });
  });

  describe('bad input', () => {
    it('throws on numbers that are not finite', () => {
      expect(() => formatMinutes(Number.NaN)).toThrow(RangeError);
      expect(() => formatMinutes(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    });
  });
});

describe('formatMinuteRange', () => {
  it('shows a step’s time the way a chip does', () => {
    expect(formatMinuteRange(45, 45)).toBe('45 min');
    expect(formatMinuteRange(40, 45)).toBe('40–45 min');
    expect(formatMinuteRange(360, 480)).toBe('6h–8h');
    expect(formatMinuteRange(45, 60)).toBe('45 min–1h');
    expect(formatMinuteRange(120, null)).toBe('2h+');
    expect(formatMinuteRange(480, null)).toBe('overnight');
    expect(formatMinuteRange(1.5, 1.5)).toBe('1.5 min');
  });
});

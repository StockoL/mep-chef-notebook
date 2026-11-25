import { describe, expect, it } from 'vitest';
import { learnedMinutes, weightedMedian, type RecordedTiming } from './learn';

const NOW = Date.UTC(2026, 10, 25);
const DAY = 86_400_000;
const t = (minutes: number, daysAgo = 0, extra: Partial<RecordedTiming> = {}): RecordedTiming => ({
  minutes,
  quantity: null,
  at: NOW - daysAgo * DAY,
  interrupted: false,
  inServiceWindow: false,
  ...extra,
});

describe('learned times (SM3)', () => {
  it('needs three timings before it replaces the written time', () => {
    expect(learnedMinutes([t(20), t(22)], NOW)).toBeNull();
    expect(learnedMinutes([t(20), t(22), t(25)], NOW)).toEqual({ minutes: 22, count: 3 });
  });

  it('uses the median, so one disaster doesn’t skew it', () => {
    expect(learnedMinutes([t(20), t(21), t(22), t(90)], NOW)?.minutes).toBe(21);
  });

  it('leaves out interrupted timings and ones taken during service', () => {
    const timings = [t(20), t(21), t(22), t(60, 0, { interrupted: true }), t(5, 0, { inServiceWindow: true })];
    expect(learnedMinutes(timings, NOW)).toEqual({ minutes: 21, count: 3 });
  });

  it('weights recent timings more: you’re getting faster', () => {
    // Three slow ones from three months ago, three quick ones this week.
    const timings = [t(40, 90), t(40, 91), t(40, 92), t(25, 1), t(25, 2), t(26, 3)];
    expect(learnedMinutes(timings, NOW)?.minutes).toBe(25);
  });

  it('scales with batch size as setup plus a rate', () => {
    // 10 min setup + 20 min per batch.
    const timings = [t(30, 1, { quantity: 1 }), t(50, 2, { quantity: 2 }), t(70, 3, { quantity: 3 })];
    expect(learnedMinutes(timings, NOW, 4)?.minutes).toBe(90);
    expect(learnedMinutes(timings, NOW, 0.5)?.minutes).toBe(20);
  });

  it('falls back to the median when sizes don’t fit a sensible line', () => {
    const timings = [t(30, 1, { quantity: 1 }), t(10, 2, { quantity: 3 }), t(28, 3, { quantity: 1 })];
    expect(learnedMinutes(timings, NOW, 2)?.minutes).toBe(28);
  });

  it('a weighted median finds the middle of the weight', () => {
    expect(weightedMedian([{ value: 1, weight: 1 }, { value: 10, weight: 5 }])).toBe(10);
  });
});

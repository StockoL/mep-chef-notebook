import { describe, expect, it } from 'vitest';
import { isReady, whatsMissing, type PartToCheck } from './readiness';

const part = (overrides: Partial<PartToCheck> = {}): PartToCheck => ({
  text: 'Roast bones',
  mode: 'passive',
  minutesMin: 40,
  equipment: 'oven-id',
  atService: false,
  hold: null,
  ...overrides,
});

describe('draft or ready', () => {
  it('a variation with no method is a draft', () => {
    expect(whatsMissing([]).map((m) => m.text)).toEqual(['No method yet']);
  });

  it('is ready when every step is complete and confirmed', () => {
    expect(isReady([{ text: 'Roast bones 40 min', confirmed: true, parts: [part()] }])).toBe(true);
  });

  it('says exactly what is missing, step by step', () => {
    const missing = whatsMissing([
      { text: 'Roast bones', confirmed: true, parts: [part({ minutesMin: null })] },
      { text: 'Simmer', confirmed: false, parts: [part({ mode: 'check-in', equipment: null })] },
      { text: '?', confirmed: true, parts: [part({ mode: null, equipment: null })] },
    ]);
    expect(missing.map((m) => m.text)).toEqual(['Step 1: no time', 'Step 2: no equipment', 'Step 2: not confirmed', 'Step 3: what kind of step?']);
  });

  it('names the part when a step has several', () => {
    const missing = whatsMissing([{ text: '', confirmed: true, parts: [part(), part({ text: 'blend until very smooth', mode: 'active', minutesMin: null })] }]);
    expect(missing.map((m) => m.text)).toEqual(['Step 1, blend until very smooth: no time']);
  });

  it('active work needs no equipment; service work needs no time; a hold needs nothing', () => {
    expect(
      isReady([
        {
          text: '',
          confirmed: true,
          parts: [
            part({ mode: 'active', equipment: null }),
            part({ mode: 'active', minutesMin: null, atService: true }),
            part({ mode: null, minutesMin: null, equipment: null, hold: { minutes: 4320 } }),
          ],
        },
      ]),
    ).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { partFlags, readMethod, readStep } from './parseStep';
import { fahrenheitToCelsius, readMinutes, readSetting, normaliseStepText } from './tokens';

/** The reader on lines that aren't in the test set, so the rules aren't only fitted to it. */
const one = (line: string) => {
  const parts = readStep(line);
  expect(parts).toHaveLength(1);
  return parts[0]!;
};

describe('times', () => {
  const minutes = (text: string) => readMinutes(normaliseStepText(text)).value;
  it('reads single times, ranges, fractions and open ends', () => {
    expect(minutes('simmer 2½ hrs')).toEqual({ min: 150, max: 150 });
    expect(minutes('braise 3-3.5 hrs')).toEqual({ min: 180, max: 210 });
    expect(minutes('20–25 min')).toEqual({ min: 20, max: 25 });
    expect(minutes('1h30')).toEqual({ min: 90, max: 90 });
    expect(minutes('min 2 hrs')).toEqual({ min: 120, max: null });
    expect(minutes('1 hr+')).toEqual({ min: 60, max: null });
    expect(minutes('overnight')).toEqual({ min: 480, max: null });
    expect(minutes('90 sec')).toEqual({ min: 1.5, max: 1.5 });
  });
  it('leaves quantities alone', () => {
    expect(minutes('add 2L stock')).toBeNull();
    expect(minutes('1.5kg potatoes')).toBeNull();
    expect(minutes('cut 2cm')).toBeNull();
    expect(minutes('reduce by 2/3')).toBeNull();
    expect(minutes('3:2:1 vinegar')).toBeNull();
  });
});

describe('settings', () => {
  const setting = (text: string) => readSetting(normaliseStepText(text)).value;
  it('converts gas marks and °F to °C', () => {
    expect(setting('gas 4')).toBe('180°C');
    expect(setting('gas mark 7')).toBe('220°C');
    expect(setting('350F')).toBe('180°C');
    expect(fahrenheitToCelsius(140)).toBe(60);
  });
  it('reads °C, fan and heat words', () => {
    expect(setting('180°C')).toBe('180°C');
    expect(setting('fan 160')).toBe('160°C fan');
    expect(setting('roast at 180 for 25 min')).toBe('180°C');
    expect(setting('medium heat')).toBe('medium');
  });
});

describe('readStep', () => {
  it('reads the verb, equipment, time and setting', () => {
    const part = one('Confit duck legs 120c 6 hrs');
    expect([part.mode, part.equipment, part.setting, part.minutes]).toEqual(['passive', 'oven', '120°C', { min: 360, max: 360 }]);
    expect(part.previousDay).toBe(false);
  });

  it('flags a step with no time for an estimate', () => {
    expect(partFlags(one('Chop onions fine'))).toEqual(['needs-estimate']);
  });

  it('lets other words override the verb', () => {
    expect(one('Whisk cream to soft peaks by hand')).toMatchObject({ mode: 'active', equipment: 'bench' });
    expect(one('Sous vide 54c 2 hrs')).toMatchObject({ mode: 'passive', equipment: 'water bath' });
  });

  it('reads loosely written verbs', () => {
    expect(one('Proving 45 min')).toMatchObject({ mode: 'passive', verb: 'prove' });
    expect(one('Roasted 20 min')).toMatchObject({ mode: 'passive', verb: 'roast' });
  });

  it('splits several steps on one line', () => {
    const parts = readStep('Cook risotto base 12 min, spread on tray, chill');
    expect(parts.map((p) => [p.text, p.mode, p.equipment])).toEqual([
      ['Cook risotto base 12 min', 'check-in', 'hob'],
      ['spread on tray', 'active', 'bench'],
      ['chill', 'passive', 'fridge'],
    ]);
  });

  it('keeps the chef’s wording for each part, without a hold that was pulled out', () => {
    const parts = readStep('Clarify butter 10 min, sabayon over bain, emulsify. Hold warm max 2 hrs');
    expect(parts.map((p) => p.text)).toEqual(['Clarify butter 10 min', 'sabayon over bain', 'emulsify']);
    expect(parts[2]).toMatchObject({ critical: 'hot-hold', hold: { minutes: 120, where: 'warm' } });
  });

  it('marks cooling as critical and not pausable', () => {
    expect(one('Cool to below 5c within 90 min')).toMatchObject({ critical: 'cooling', pausable: false, setting: '5°C' });
  });

  it('carries the step before into a time that runs on', () => {
    const [first, second] = readMethod(['Roast bones 200c 40 min', 'Add veg, roast 20 more']);
    expect(first![0]!.setting).toBe('200°C');
    expect(second![0]).toMatchObject({ relativeTime: true, equipment: 'oven', setting: '200°C', minutes: { min: 20, max: 20 } });
  });

  it('reads @ references and another recipe’s method', () => {
    expect(one('Add @veal stock, reduce 1 hr').dependsOn).toEqual(['Veal stock']);
    expect(one('Roast wings 200c 30 min, then as brown stock').templateRef).toBe('Brown stock');
  });

  it('returns nothing for an empty line', () => {
    expect(readStep('   ')).toEqual([]);
  });
});

describe('the chef’s word list', () => {
  it('overrides the built-in meaning of a word', () => {
    const words = [{ word: 'toast', mode: 'passive' as const, equipment: null }];
    expect(readStep('Toast seeds 10 min', { words })[0]).toMatchObject({ mode: 'passive', equipment: 'oven' });
  });

  it('teaches a word the reader didn’t know', () => {
    expect(readStep('Pickle shallots 30 min')[0]!.verb).toBeNull();
    const words = [{ word: 'pickle', mode: 'passive' as const, equipment: 'fridge' }];
    expect(readStep('Pickle shallots 30 min', { words })[0]).toMatchObject({ verb: 'pickle', mode: 'passive', equipment: 'fridge' });
  });

  it('reads equipment the chef added to the list', () => {
    const words = [{ word: 'paco', mode: 'active' as const, equipment: 'Pacojet' }];
    expect(readStep('Paco twice', { words })[0]).toMatchObject({ equipment: 'Pacojet' });
  });
});

describe('typed corrections', () => {
  it('reads bare numbers as minutes, and anything else as in a step', async () => {
    const { readTypedMinutes } = await import('./tokens');
    expect(readTypedMinutes('45')).toEqual({ min: 45, max: 45 });
    expect(readTypedMinutes('40-45')).toEqual({ min: 40, max: 45 });
    expect(readTypedMinutes('2+')).toEqual({ min: 2, max: null });
    expect(readTypedMinutes('1h30')).toEqual({ min: 90, max: 90 });
    expect(readTypedMinutes('overnight')).toEqual({ min: 480, max: null });
    expect(readTypedMinutes('soon')).toBeNull();
  });
});

describe('by hand, and the kitchen’s own equipment', () => {
  it('reads a bowl or a hand whisk as active work by hand', () => {
    expect(one('Whisk flour, lager and turmeric in a bowl, 5 min')).toMatchObject({ mode: 'active', equipment: 'bench', minutes: { min: 5, max: 5 } });
    expect(one('Whisk eggs with a hand whisk')).toMatchObject({ mode: 'active', equipment: 'bench' });
  });
  it('reads equipment on the kitchen’s list', () => {
    expect(readStep('Spin in the Pacojet twice', { equipmentNames: ['Oven', 'Pacojet'] })[0]!.equipment).toBe('Pacojet');
    expect(readStep('Whisk in the mixing bowl', { equipmentNames: ['Mixing bowl'] })[0]!.equipment).toBe('Mixing bowl');
  });
  it('“on the day before service” is the same day', () => {
    expect(one('Make batter on the day before service').previousDay).toBe(false);
    expect(one('Make batter the day before').previousDay).toBe(true);
  });
});

describe('reheating', () => {
  it('is a critical point', () => {
    expect(readStep('Reheat in a pan 5 min')[0]).toMatchObject({ critical: 'reheat', pausable: true });
  });
});

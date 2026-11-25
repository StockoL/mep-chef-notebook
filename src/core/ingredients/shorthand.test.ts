import { describe, expect, it } from 'vitest';
import { formatShorthand, parseItem, parseNumber, parseShorthand, splitItems } from './shorthand';

describe('splitItems', () => {
  it('splits on commas and new lines', () => {
    expect(splitItems('bones 2kg, mirepoix\ntom puree')).toEqual(['bones 2kg', 'mirepoix', 'tom puree']);
  });

  it('keeps decimal commas and commas in brackets', () => {
    expect(splitItems('flour 1,5kg, shallots (peeled, sliced)')).toEqual(['flour 1,5kg', 'shallots (peeled, sliced)']);
  });
});

describe('parseNumber', () => {
  it('reads the ways chefs write numbers', () => {
    expect(parseNumber('2')).toBe(2);
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('½')).toBe(0.5);
    expect(parseNumber('1½')).toBe(1.5);
    expect(parseNumber('3/4')).toBe(0.75);
  });
});

describe('parseItem', () => {
  it('reads a quantity after the name', () => {
    expect(parseItem('bones 2kg')).toEqual({ name: 'bones', quantity: 2, unit: 'kg', prepNote: '' });
    expect(parseItem('cream 500 ml')).toEqual({ name: 'cream', quantity: 500, unit: 'ml', prepNote: '' });
    expect(parseItem('thyme 3 sprigs')).toEqual({ name: 'thyme', quantity: 3, unit: 'sprig', prepNote: '' });
  });

  it('reads a quantity before the name', () => {
    expect(parseItem('2kg bones')).toEqual({ name: 'bones', quantity: 2, unit: 'kg', prepNote: '' });
    expect(parseItem('1½ l chicken stock')).toEqual({ name: 'chicken stock', quantity: 1.5, unit: 'l', prepNote: '' });
  });

  it('treats a bare number as a count', () => {
    expect(parseItem('3 eggs')).toEqual({ name: 'eggs', quantity: 3, unit: 'each', prepNote: '' });
    expect(parseItem('egg yolks 4')).toEqual({ name: 'egg yolks', quantity: 4, unit: 'each', prepNote: '' });
    expect(parseItem('3 large eggs')).toEqual({ name: 'large eggs', quantity: 3, unit: 'each', prepNote: '' });
  });

  it('allows lines without quantities', () => {
    expect(parseItem('mirepoix')).toEqual({ name: 'mirepoix', quantity: null, unit: null, prepNote: '' });
  });

  it('reads a prep note in brackets', () => {
    expect(parseItem('shallots 200g (brunoise)')).toEqual({ name: 'shallots', quantity: 200, unit: 'g', prepNote: 'brunoise' });
  });

  it('turns centilitres into millilitres', () => {
    expect(parseItem('brandy 5cl')).toEqual({ name: 'brandy', quantity: 50, unit: 'ml', prepNote: '' });
  });

  it('understands common spellings of units', () => {
    expect(parseItem('flour 1 kilo').unit).toBe('kg');
    expect(parseItem('milk 2 litres').unit).toBe('l');
    expect(parseItem('salt 1 tsp').unit).toBe('tsp');
  });
});

describe('parseShorthand', () => {
  it('reads the SPEC example', () => {
    expect(parseShorthand('bones 2kg, mirepoix, tom puree, thyme, bay')).toEqual([
      { name: 'bones', quantity: 2, unit: 'kg', prepNote: '' },
      { name: 'mirepoix', quantity: null, unit: null, prepNote: '' },
      { name: 'tom puree', quantity: null, unit: null, prepNote: '' },
      { name: 'thyme', quantity: null, unit: null, prepNote: '' },
      { name: 'bay', quantity: null, unit: null, prepNote: '' },
    ]);
  });

  it('drops a quantity with no name and empty items', () => {
    expect(parseShorthand('2kg, , \n')).toEqual([]);
  });
});

describe('formatShorthand', () => {
  it('writes rows back as shorthand', () => {
    expect(formatShorthand({ name: 'Bones', quantity: 2, unit: 'kg', prepNote: '' })).toBe('Bones 2kg');
    expect(formatShorthand({ name: 'Thyme', quantity: 3, unit: 'sprig', prepNote: '' })).toBe('Thyme 3 sprigs');
    expect(formatShorthand({ name: 'Eggs', quantity: 3, unit: 'each', prepNote: '' })).toBe('Eggs 3');
    expect(formatShorthand({ name: 'Shallots', quantity: 200, unit: 'g', prepNote: 'brunoise' })).toBe('Shallots 200g (brunoise)');
    expect(formatShorthand({ name: 'Bay', quantity: null, unit: null, prepNote: '' })).toBe('Bay');
  });

  it('round-trips through the reader', () => {
    for (const text of ['Bones 2kg', 'Thyme 3 sprigs', 'Eggs 3', 'Shallots 200g (brunoise)', 'Bay']) {
      expect(formatShorthand(parseItem(text))).toBe(text);
    }
  });
});

describe('amounts written without a number (beer batter)', () => {
  const read = (text: string) => {
    const { name, quantity, unit } = parseItem(text);
    return [name, quantity, unit];
  };
  it('reads a unit with no number as one', () => {
    expect(read('turmeric pinch')).toEqual(['turmeric', 1, 'pinch']);
    expect(read('lager/beer pint')).toEqual(['lager/beer', 1, 'pint']);
    expect(read('pinch of salt')).toEqual(['salt', 1, 'pinch']);
    expect(read('a handful of parsley')).toEqual(['parsley', 1, 'handful']);
    expect(read('knob butter')).toEqual(['butter', 1, 'knob']);
    expect(read('splash vinegar')).toEqual(['vinegar', 1, 'splash']);
    expect(read('worcester sauce dash')).toEqual(['worcester sauce', 1, 'dash']);
    expect(read('smidgen of cayenne')).toEqual(['cayenne', 1, 'smidgen']);
    expect(read('olive oil glug')).toEqual(['olive oil', 1, 'glug']);
    expect(read('2 dollops creme fraiche')).toEqual(['creme fraiche', 2, 'dollop']);
  });
  it('reads half', () => {
    expect(read('half pint lager')).toEqual(['lager', 0.5, 'pint']);
    expect(read('lager half a pint')).toEqual(['lager', 0.5, 'pint']);
  });
  it('reads pints with numbers, and shows them as written', () => {
    expect(read('lager 1 pint')).toEqual(['lager', 1, 'pint']);
    expect(read('2 pints milk')).toEqual(['milk', 2, 'pint']);
    expect(read('milk ½ pint')).toEqual(['milk', 0.5, 'pint']);
    expect(formatShorthand(parseItem('lager 2 pints'))).toBe('lager 2 pints');
  });
  it('leaves names that end in a unit-like word alone', () => {
    expect(read('bay leaf')).toEqual(['bay leaf', null, null]);
    expect(read('garlic clove')).toEqual(['garlic clove', null, null]);
  });
});

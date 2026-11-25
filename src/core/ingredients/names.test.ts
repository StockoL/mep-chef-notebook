import { describe, expect, it } from 'vitest';
import { capitalise, findByName, nameContains, namesMatch, normalizeName, singular } from './names';

describe('normalizeName', () => {
  it('folds case, accents and spacing', () => {
    expect(normalizeName('  Crème   Fraîche ')).toBe('creme fraiche');
    expect(normalizeName('Tomato purée')).toBe('tomato puree');
  });
});

describe('singular', () => {
  it('makes the last word singular', () => {
    expect(singular('shallots')).toBe('shallot');
    expect(singular('cherries')).toBe('cherry');
    expect(singular('tomatoes')).toBe('tomato');
    expect(singular('radishes')).toBe('radish');
    expect(singular('egg yolks')).toBe('egg yolk');
  });

  it('leaves words that only look plural', () => {
    expect(singular('asparagus')).toBe('asparagus');
    expect(singular('cress')).toBe('cress');
    expect(singular('peas')).toBe('pea');
  });
});

describe('namesMatch', () => {
  it('matches plural, case and accents', () => {
    expect(namesMatch('Shallots', 'shallot')).toBe(true);
    expect(namesMatch('creme fraiche', 'Crème fraîche')).toBe(true);
    expect(namesMatch('bones', 'veal bones')).toBe(false);
  });
});

describe('findByName', () => {
  const items = [
    { id: 'a', name: 'Tomato purée', aliases: ['tom puree'] },
    { id: 'b', name: 'Chicken stock', aliases: [] },
  ];
  it('finds by name or alias', () => {
    expect(findByName(items, 'tom puree')?.id).toBe('a');
    expect(findByName(items, 'chicken stocks')?.id).toBe('b');
    expect(findByName(items, 'veal stock')).toBeUndefined();
  });
});

describe('nameContains', () => {
  it('finds part of a name or alias', () => {
    expect(nameContains({ name: 'Beetroot gel', aliases: [] }, 'beet')).toBe(true);
    expect(nameContains({ name: 'Tomato purée', aliases: ['tom puree'] }, 'puree')).toBe(true);
    expect(nameContains({ name: 'Jus' }, '')).toBe(false);
  });
});

describe('capitalise', () => {
  it('capitalises the first letter only', () => {
    expect(capitalise('tom puree')).toBe('Tom puree');
  });
});

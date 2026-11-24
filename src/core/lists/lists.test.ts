import { describe, expect, it } from 'vitest';
import { cleanName, moveItem, nameProblem, nextOrder, type ListItem } from './lists';

const sections: ListItem[] = [
  { id: 'a', name: 'Starters', order: 0, hidden: false },
  { id: 'b', name: 'Fish', order: 1, hidden: false },
  { id: 'c', name: 'Larder', order: 2, hidden: true },
];

describe('cleanName', () => {
  it('trims and squashes spaces', () => {
    expect(cleanName('  Starters   and  garnish ')).toBe('Starters and garnish');
  });
});

describe('nameProblem', () => {
  it('accepts a new name', () => {
    expect(nameProblem('Meat', sections)).toBeNull();
  });

  it('refuses an empty name', () => {
    expect(nameProblem('   ', sections)).toMatch(/name/);
  });

  it('refuses a name already on the list, ignoring case', () => {
    expect(nameProblem('fish', sections)).toMatch(/"Fish" is already/);
  });

  it('lets an item keep its own name when renaming', () => {
    expect(nameProblem('Fish', sections, 'b')).toBeNull();
  });

  it('allows reusing the name of a hidden item', () => {
    expect(nameProblem('Larder', sections)).toBeNull();
  });
});

describe('moveItem', () => {
  it('moves an item down and renumbers the list', () => {
    expect(moveItem(sections, 'a', 1)).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
      { id: 'c', order: 2 },
    ]);
  });

  it('stops at the top', () => {
    expect(moveItem(sections, 'a', -1).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('nextOrder', () => {
  it('puts a new item last', () => {
    expect(nextOrder(sections)).toBe(3);
    expect(nextOrder([])).toBe(0);
  });
});

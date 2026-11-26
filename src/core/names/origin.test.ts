import { describe, expect, it } from 'vitest';
import { matchKitchen, splitOriginSuffix } from './origin';

describe('names with where they’re from', () => {
  it('reads the place and year off the end', () => {
    expect(splitOriginSuffix('Cornish sea bass (Dumbleton, 2026)')).toEqual({ name: 'Cornish sea bass', place: 'Dumbleton', year: 2026 });
    expect(splitOriginSuffix('Steak (Dumbleton 2026)')).toEqual({ name: 'Steak', place: 'Dumbleton', year: 2026 });
    expect(splitOriginSuffix('Fish and chips (Ellenborough Park)')).toEqual({ name: 'Fish and chips', place: 'Ellenborough Park', year: null });
    expect(splitOriginSuffix("Beer batter (Ellenborough, '25)")).toEqual({ name: 'Beer batter', place: 'Ellenborough', year: 2025 });
  });

  it('leaves names without such an ending', () => {
    expect(splitOriginSuffix('Roasted beef sirloin')).toBeNull();
    expect(splitOriginSuffix('(Dumbleton)')).toBeNull();
    expect(splitOriginSuffix('Pressed terrine (2026)')).toBeNull();
  });

  it('finds the kitchen meant', () => {
    const kitchens = [{ name: 'Dumbleton Hall' }, { name: 'Ellenborough Park' }, { name: 'The Wild Rabbit' }];
    expect(matchKitchen('Dumbleton', kitchens)?.name).toBe('Dumbleton Hall');
    expect(matchKitchen('dumbleton hall', kitchens)?.name).toBe('Dumbleton Hall');
    expect(matchKitchen('Wild Rabbit', kitchens)?.name).toBe('The Wild Rabbit');
    expect(matchKitchen('Dumb', kitchens)).toBeNull();
    expect(matchKitchen('Grandma', kitchens)).toBeNull();
  });
});

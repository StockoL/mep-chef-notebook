import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MepDatabase } from './db';
import { componentOrigins, findSuffixedNames, MINE, originChoices, setDishKitchen, tidySuffixedNames } from './dishOrigin';
import { createKitchen, setKitchenArchived } from './kitchens';
import { createComponent, createDish, getVariationInUse, setVariationOrigin } from './library';
import { restoreSnapshot } from './snapshot';
import { freshDatabase } from './testing';

let db: MepDatabase;
let dumbleton: string;
let ellenborough: string;
beforeEach(async () => {
  db = await freshDatabase();
  dumbleton = await createKitchen('Dumbleton Hall', db);
  ellenborough = await createKitchen('Ellenborough Park', db);
  await setKitchenArchived(ellenborough, true, db);
});
afterEach(async () => {
  await db.delete();
});

describe('where dishes and recipes are from', () => {
  it('a new dish is from the kitchen it’s written in; "No kitchen" is the chef’s own', async () => {
    const steak = await createDish('Steak', dumbleton, db);
    const toast = await createDish('Toast', 'none', db);
    expect((await db.dishes.get(steak))?.kitchenId).toBe(dumbleton);
    expect((await db.dishes.get(toast))?.kitchenId).toBeNull();
    await setDishKitchen(toast, ellenborough, db);
    expect((await db.dishes.get(toast))?.kitchenId).toBe(ellenborough);
  });

  it('offers the kitchens with something in the book, the current one first, then Mine', async () => {
    await createDish('Fish and chips', ellenborough, db);
    await createComponent('Jus', dumbleton, db);
    const mine = await createComponent('Granola', 'none', db);
    expect((await componentOrigins(db)).get(mine)).toEqual(new Set([MINE]));
    expect((await originChoices(dumbleton, db)).map((c) => c.label)).toEqual(['Dumbleton Hall', 'Ellenborough Park', 'Mine']);
  });
});

describe('tidying "(Dumbleton, 2026)" off names', () => {
  it('records the kitchen instead, with undo', async () => {
    const dish = await createDish('Cornish sea bass (Dumbleton, 2026)', null, db);
    const batter = await createComponent('Beer batter (Ellenborough)', 'none', db);
    await createDish('Pressed terrine (2026)', null, db);
    await createDish('Soup (Grandma)', null, db);
    expect((await findSuffixedNames(db)).map((f) => [f.tidied, f.kitchenName])).toEqual([
      ['Cornish sea bass', 'Dumbleton Hall'],
      ['Beer batter', 'Ellenborough Park'],
    ]);

    const { count, snapshot } = await tidySuffixedNames(db);
    expect(count).toBe(2);
    expect(await db.dishes.get(dish)).toMatchObject({ name: 'Cornish sea bass', kitchenId: dumbleton });
    expect((await db.components.get(batter))?.name).toBe('Beer batter');
    expect(await getVariationInUse(batter, ellenborough, db)).toMatchObject({ source: 'house', kitchenId: ellenborough });
    expect(await findSuffixedNames(db)).toEqual([]);

    await restoreSnapshot(snapshot, db);
    expect((await db.dishes.get(dish))?.name).toBe('Cornish sea bass (Dumbleton, 2026)');
    expect((await getVariationInUse(batter, ellenborough, db))?.source).toBe('mine');
  });

  it('leaves a recipe’s several ways of making it alone, but still tidies the name', async () => {
    const jus = await createComponent('Jus (Dumbleton)', 'none', db);
    const own = (await getVariationInUse(jus, dumbleton, db))!;
    await db.variations.add({ ...own, id: 'second', source: 'book', sourceDetail: 'Leiths' });
    await setVariationOrigin(own.id, { source: 'mine' }, db);
    await tidySuffixedNames(db);
    expect((await db.components.get(jus))?.name).toBe('Jus');
    expect((await db.variations.get(own.id))?.source).toBe('mine');
  });
});

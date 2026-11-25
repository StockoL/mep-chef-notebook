import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import type { MepDatabase } from './db';
import { exportData } from './exportData';
import { importData } from './importData';
import { createKitchen } from './kitchens';
import {
  addComponentToDish,
  createComponent,
  createDish,
  createIngredient,
  deleteComponent,
  deleteIngredient,
  deleteUnusedIngredients,
  getComponentDetails,
  getDishDetails,
  getIngredientDetails,
  getVariationInUse,
  saveLines,
  saveSteps,
} from './library';
import { listRecent, recordView, searchLibrary } from './search';
import { restoreSnapshot } from './snapshot';
import { createCollection, ensureTag, listTags, toggleInCollection } from './tags';
import { freshDatabase } from './testing';
import { NO_KITCHEN_ID } from './types';

let db: MepDatabase;
beforeEach(async () => {
  db = await freshDatabase();
});
afterEach(async () => {
  await db.delete();
});

/** A component with shorthand lines, as the chef would type it. */
async function component(name: string, lines: string, kitchenId = NO_KITCHEN_ID) {
  const id = await createComponent(name, kitchenId, db);
  const variation = await getVariationInUse(id, kitchenId, db);
  await saveLines(variation!.id, parseShorthand(lines), db);
  return { id, variationId: variation!.id };
}

describe('components', () => {
  it('starts as a draft: house in a kitchen, the chef’s own with no kitchen', async () => {
    const kitchenId = await createKitchen('Dumbleton Hall', db);
    const house = await createComponent('Chicken jus', kitchenId, db);
    const mine = await createComponent('Beetroot gel', NO_KITCHEN_ID, db);
    expect(await getVariationInUse(house, kitchenId, db)).toMatchObject({ source: 'house', kitchenId, status: 'draft' });
    expect(await getVariationInUse(mine, NO_KITCHEN_ID, db)).toMatchObject({ source: 'mine', kitchenId: null });
  });

  it('reads shorthand lines, creating unknown ingredients once', async () => {
    const { id } = await component('Brown chicken stock', 'bones 2kg, mirepoix, tom puree 1 tbsp');
    const details = await getComponentDetails(id, NO_KITCHEN_ID, db);
    expect(details?.lines.map((l) => [l.name, l.line.quantity, l.line.unit])).toEqual([
      ['Bones', 2, 'kg'],
      ['Mirepoix', null, null],
      ['Tom puree', 1, 'tbsp'],
    ]);
    await component('Veal stock', 'bones 3kg, mirepoix');
    expect(await db.ingredients.count()).toBe(3);
  });

  it('points a line at another component when the name matches', async () => {
    const stock = await component('Chicken stock', 'bones 2kg');
    const jus = await component('Chicken jus', 'chicken stock 2l, shallots 200g (sliced)');
    const details = await getComponentDetails(jus.id, NO_KITCHEN_ID, db);
    expect(details?.lines[0]).toMatchObject({ name: 'Chicken stock', target: { kind: 'component', id: stock.id } });
    expect(details?.lines[1]?.line.prepNote).toBe('sliced');
    expect((await getComponentDetails(stock.id, NO_KITCHEN_ID, db))?.usedInComponents.map((c) => c.name)).toEqual(['Chicken jus']);
  });

  it('tidies away ingredients a half-typed name created', async () => {
    const { variationId } = await component('Stock', 'bon');
    const created = await saveLines(variationId, parseShorthand('bones 2kg'), db);
    await deleteUnusedIngredients([...(await db.ingredients.toArray()).map((i) => i.id)], db);
    expect((await db.ingredients.toArray()).map((i) => i.name)).toEqual(['Bones']);
    expect(created).toHaveLength(1);
  });

  it('updates lines in place so ids stay stable', async () => {
    const { id, variationId } = await component('Gel', 'beetroot 500g, agar 4g');
    const before = (await getComponentDetails(id, NO_KITCHEN_ID, db))!.lines.map((l) => l.line.id);
    await saveLines(variationId, parseShorthand('beetroot 600g'), db);
    const after = (await getComponentDetails(id, NO_KITCHEN_ID, db))!.lines;
    expect(after.map((l) => l.line.id)).toEqual([before[0]]);
    expect(after[0]?.line.quantity).toBe(600);
  });

  it('saves steps one per line, unconfirmed', async () => {
    const { id, variationId } = await component('Stock', 'bones 2kg');
    await saveSteps(variationId, ['Roast bones 45 min', '', 'Simmer 6 hrs, skim'], db);
    const steps = (await getComponentDetails(id, NO_KITCHEN_ID, db))!.steps;
    expect(steps.map((s) => [s.order, s.text, s.confirmed])).toEqual([
      [0, 'Roast bones 45 min', false],
      [1, 'Simmer 6 hrs, skim', false],
    ]);
  });

  it('deletes with everything that belongs to it, and Undo puts it all back', async () => {
    const { id } = await component('Gel', 'beetroot 500g');
    const dishId = await createDish('Beetroot, goat’s cheese', db);
    await addComponentToDish(dishId, id, db);
    const snapshot = await deleteComponent(id, db);
    expect(await db.components.count()).toBe(0);
    expect(await db.lines.count()).toBe(0);
    expect((await getDishDetails(dishId, db))?.components).toEqual([]);
    await restoreSnapshot(snapshot, db);
    expect((await getComponentDetails(id, NO_KITCHEN_ID, db))?.lines).toHaveLength(1);
    expect((await getDishDetails(dishId, db))?.components).toHaveLength(1);
  });

  it('won’t delete a component another one uses', async () => {
    await component('Chicken stock', 'bones 2kg');
    await component('Chicken jus', 'chicken stock 2l');
    const stock = (await db.components.where('name').equals('Chicken stock').first())!;
    await expect(deleteComponent(stock.id, db)).rejects.toThrow(/Chicken jus/);
  });
});

describe('ingredient lookup (I1)', () => {
  it('lists every component and dish that uses an ingredient, through components', async () => {
    await component('Chicken stock', 'chicken bones 2kg');
    const jus = await component('Chicken jus', 'chicken stock 2l');
    const dishId = await createDish('Roast chicken', db);
    await addComponentToDish(dishId, jus.id, db);
    const bones = (await db.ingredients.where('name').equals('Chicken bones').first())!;
    const details = await getIngredientDetails(bones.id, db);
    expect(details?.components.map((c) => c.name)).toEqual(['Chicken jus', 'Chicken stock']);
    expect(details?.dishes.map((d) => d.name)).toEqual(['Roast chicken']);
  });

  it('only deletes an ingredient nothing uses', async () => {
    await component('Stock', 'bones 2kg');
    const bones = (await db.ingredients.toArray())[0]!;
    await expect(deleteIngredient(bones.id, db)).rejects.toThrow(/still used/);
    const salt = await createIngredient('salt', db);
    expect(await createIngredient('Salt', db)).toBe(salt); // found, not duplicated
    await deleteIngredient(salt, db);
    expect(await db.ingredients.get(salt)).toBeUndefined();
  });
});

describe('search, recent, tags and collections', () => {
  it('finds by name, alias and notes, grouped by kind', async () => {
    const { id } = await component('Beetroot gel', 'beetroot 500g');
    await db.components.update(id, { aliases: ['red gel'] });
    await createDish('Beetroot tartare', db);
    const results = await searchLibrary('beet', db);
    expect(results.components.map((c) => c.name)).toEqual(['Beetroot gel']);
    expect(results.dishes.map((d) => d.name)).toEqual(['Beetroot tartare']);
    expect(results.ingredients.map((i) => i.name)).toEqual(['Beetroot']);
    expect((await searchLibrary('red gel', db)).components).toHaveLength(1);
  });

  it('remembers recently opened items, newest first, without repeats', async () => {
    const a = await createDish('A', db);
    const b = await createComponent('B', NO_KITCHEN_ID, db);
    await recordView({ kind: 'dish', id: a }, db);
    await recordView({ kind: 'component', id: b }, db);
    await recordView({ kind: 'dish', id: a }, db);
    expect((await listRecent(db)).map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('reuses a tag whatever the case or plural', async () => {
    const first = await ensureTag('Canapé', db);
    expect(await ensureTag('canapés', db)).toBe(first);
    expect((await listTags(db)).map((t) => t.name)).toEqual(['canapé']);
  });

  it('adds to and removes from a collection', async () => {
    const collectionId = await createCollection('Christmas ideas', db);
    const dishId = await createDish('Turkey', db);
    await toggleInCollection(collectionId, { kind: 'dish', id: dishId }, db);
    expect((await db.collections.get(collectionId))?.members).toEqual([{ kind: 'dish', id: dishId }]);
    await toggleInCollection(collectionId, { kind: 'dish', id: dishId }, db);
    expect((await db.collections.get(collectionId))?.members).toEqual([]);
  });
});

describe('export → import with a library', () => {
  it('round-trips components, lines, steps, dishes and ingredients', async () => {
    const { id, variationId } = await component('Chicken stock', 'bones 2kg, mirepoix');
    await saveSteps(variationId, ['Roast bones'], db);
    const dishId = await createDish('Roast chicken', db);
    await addComponentToDish(dishId, id, db);
    const target = await freshDatabase();
    await importData(await exportData(db), target);
    expect(await getComponentDetails(id, NO_KITCHEN_ID, target)).toEqual(await getComponentDetails(id, NO_KITCHEN_ID, db));
    expect(await getDishDetails(dishId, target)).toEqual(await getDishDetails(dishId, db));
    await target.delete();
  });
});

describe('where a recipe is from', () => {
  it('moves a recipe to the house recipe of a kitchen the chef has left, equipment and all', async () => {
    const { setVariationOrigin } = await import('./library');
    const { setKitchenArchived, setPlace } = await import('./kitchens');
    const { saveSteps } = await import('./library');
    const dumbleton = await createKitchen('Dumbleton Hall', db);
    await setPlace(dumbleton, null, db);
    const id = await createComponent('Beer batter', dumbleton, db);
    const variation = (await getVariationInUse(id, dumbleton, db))!;
    await saveSteps(variation.id, ['Whisk in a bowl 5 min'], db);

    const ellenborough = await createKitchen('Ellenborough Park Hotel', db);
    await setKitchenArchived(ellenborough, true, db);
    await setVariationOrigin(variation.id, { source: 'house', kitchenId: ellenborough }, db);

    const moved = (await getVariationInUse(id, dumbleton, db))!;
    expect(moved).toMatchObject({ source: 'house', kitchenId: ellenborough });
    const step = (await db.steps.where('versionId').equals(moved.currentVersionId!).first())!;
    const equipment = await db.listValues.get(step.parts[0]!.equipmentTypeId!);
    expect(equipment).toMatchObject({ kitchenId: ellenborough, value: 'Bench' });

    await setVariationOrigin(variation.id, { source: 'book', sourceDetail: 'Leiths' }, db);
    expect(await db.variations.get(variation.id)).toMatchObject({ source: 'book', kitchenId: null, sourceDetail: 'Leiths' });
  });
});

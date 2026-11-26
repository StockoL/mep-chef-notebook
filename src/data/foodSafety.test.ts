import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import { componentAllergens, dishAllergens } from './allergens';
import type { MepDatabase } from './db';
import { getBatchLabel, getTargets, makeBatch, setInitials, setShelfLife, setTarget, shelfLifeFor } from './foodSafety';
import { createKitchen, setPlace } from './kitchens';
import { addComponentToDish, createComponent, createDish, getComponentDetails, getVariationInUse, saveLines, updateComponent, updateIngredient } from './library';
import { getListItems } from './lists';
import { createProduct, deleteProduct, markChecked, setLineProduct, updateProduct } from './products';
import { restoreSnapshot } from './snapshot';
import { freshDatabase, loadSeed } from './testing';

let db: MepDatabase;
let kitchenId: string;
beforeEach(async () => {
  db = await freshDatabase();
  kitchenId = await createKitchen('Dumbleton Hall', db);
  await setPlace(kitchenId, db);
});
afterEach(async () => {
  await db.delete();
});

async function recipe(name: string, lines: string) {
  const id = await createComponent(name, kitchenId, db);
  await saveLines((await getVariationInUse(id, kitchenId, db))!.id, parseShorthand(lines), db);
  return id;
}
const ingredient = async (name: string) => (await db.ingredients.toArray()).find((i) => i.name === name)!;

describe('allergens through components (FS1, FS5)', () => {
  it('a bought-in ingredient is “not confirmed” until its product is known, and uses the only one there is', async () => {
    const remoulade = await recipe('Rémoulade', 'celeriac 500g, mayonnaise 200g, dijon 1 tbsp');
    const mayo = await ingredient('Mayonnaise');
    await updateIngredient(mayo.id, { kind: 'bought-in' }, db);
    await updateIngredient((await ingredient('Dijon')).id, { allergens: ['mustard'] }, db);

    let allergens = await componentAllergens(remoulade, kitchenId, null, db);
    expect(allergens.complete).toBe(false);
    expect(allergens.toConfirm.map((l) => l.ingredientName)).toEqual(['Mayonnaise']);
    expect(allergens.contains.map((c) => c.label)).toEqual(['Mustard']);

    // One product in this kitchen: the line uses it without asking, but only once its label's checked.
    const hellmanns = await createProduct(mayo.id, kitchenId, 'Hellmann’s', db);
    expect((await componentAllergens(remoulade, kitchenId, null, db)).complete).toBe(false);
    await updateProduct(hellmanns, { contains: ['eggs', 'mustard'], mayContain: ['milk'] }, db);
    allergens = await componentAllergens(remoulade, kitchenId, null, db);
    expect(allergens.complete).toBe(true);
    expect(allergens.contains.map((c) => [c.label, c.from])).toEqual([
      ['Eggs', ['Mayonnaise']],
      ['Mustard', ['Mayonnaise', 'Dijon']],
    ]);
    expect(allergens.mayContain.map((m) => m.label)).toEqual(['Milk']);

    // A second product: which one? Not confirmed until chosen on the line.
    const house = await createProduct(mayo.id, kitchenId, 'House mayo', db);
    await markChecked(house, new Date(), db);
    expect((await componentAllergens(remoulade, kitchenId, null, db)).complete).toBe(false);
    const line = (await getComponentDetails(remoulade, kitchenId, db))!.lines.find((l) => l.name === 'Mayonnaise')!;
    await setLineProduct(line.line.id, house, db);
    expect((await componentAllergens(remoulade, kitchenId, null, db)).complete).toBe(true);
  });

  it('says which recipes a product change affects, and deleting a product comes with undo', async () => {
    const remoulade = await recipe('Rémoulade', 'mayonnaise 200g');
    const mayo = await ingredient('Mayonnaise');
    await updateIngredient(mayo.id, { kind: 'bought-in' }, db);
    const product = await createProduct(mayo.id, kitchenId, 'Hellmann’s', db);
    expect(await updateProduct(product, { contains: ['eggs'] }, db)).toEqual({ components: ['Rémoulade'], dishes: [] });
    expect(await updateProduct(product, { brand: 'Hellmann’s Real' }, db)).toEqual({ components: [], dishes: [] });

    const snapshot = await deleteProduct(product, db);
    expect((await componentAllergens(remoulade, kitchenId, null, db)).complete).toBe(false);
    await restoreSnapshot(snapshot, db);
    expect((await componentAllergens(remoulade, kitchenId, null, db)).complete).toBe(true);
  });

  it('keeps sub-types', async () => {
    const praline = await recipe('Praline', 'hazelnuts 200g, sugar 200g');
    await updateIngredient((await ingredient('Hazelnuts')).id, { allergens: ['tree-nuts:hazelnut'] }, db);
    expect((await componentAllergens(praline, kitchenId, null, db)).contains).toEqual([{ allergen: 'tree-nuts', label: 'Tree nuts', subTypes: ['hazelnut'], from: ['Hazelnuts'] }]);
  });
});

describe('allergens are never “none” when nothing is recorded (FEEL_PASS 1)', () => {
  const dishOf = async (...components: string[]) => {
    const dish = await createDish('Cod', kitchenId, db);
    for (const c of components) await addComponentToDish(dish, c, db);
    return dishAllergens(dish, kitchenId, db);
  };

  it('an empty component is not known yet', async () => {
    const empty = await createComponent('Garnish', kitchenId, db);
    expect(await componentAllergens(empty, kitchenId, null, db)).toMatchObject({ empty: true, complete: false, contains: [] });
  });

  it('an empty dish, and a dish whose components are all empty, are not known yet', async () => {
    expect(await dishOf()).toMatchObject({ empty: true, complete: false });
    expect(await dishOf(await createComponent('Garnish', kitchenId, db), await createComponent('Sauce', kitchenId, db))).toMatchObject({ empty: true, complete: false });
  });

  it('one empty component makes a dish incomplete, and names it', async () => {
    const chips = await recipe('Chips', 'potatoes 1kg');
    const garnish = await createComponent('Garnish', kitchenId, db);
    const allergens = await dishOf(chips, garnish);
    expect(allergens).toMatchObject({ empty: false, complete: false, unrecorded: ['Garnish'] });
    expect((await dishOf(chips)).complete).toBe(true);
  });

  it('nothing in the Dumbleton seed (all drafts, no lines) reads as confirmed or “none”', async () => {
    const seedKitchen = await loadSeed(db);
    for (const dish of await db.dishes.toArray()) expect((await dishAllergens(dish.id, seedKitchen, db)).complete, dish.name).toBe(false);
    for (const c of await db.components.toArray()) expect((await componentAllergens(c.id, seedKitchen, null, db)).complete, c.name).toBe(false);
  });

  it('an empty component inside a recipe makes the recipe incomplete', async () => {
    await createComponent('Chicken stock', kitchenId, db);
    const jus = await recipe('Jus', 'chicken stock 2l, butter 50g');
    expect(await componentAllergens(jus, kitchenId, null, db)).toMatchObject({ complete: false, unrecorded: ['Chicken stock'] });
  });
});

describe('house rules, batches and labels (FS2, FS3)', () => {
  it('a component’s own shelf life wins over its type’s', async () => {
    const sauce = await recipe('Beurre blanc', 'butter 250g');
    const sauces = (await getListItems({ kind: 'values', list: 'component-types', kitchenId: null }, db)).find((t) => t.name === 'Sauces and emulsions')!;
    await updateComponent(sauce, { typeId: sauces.id }, db);
    expect(await shelfLifeFor(sauce, kitchenId, db)).toBeNull();
    await setShelfLife(kitchenId, { componentTypeId: sauces.id }, '3 days', db);
    expect(await shelfLifeFor(sauce, kitchenId, db)).toEqual({ text: '3 days', minutes: 3 * 1440, from: 'type' });
    await setShelfLife(kitchenId, { componentId: sauce }, '1 day', db);
    expect((await shelfLifeFor(sauce, kitchenId, db))?.from).toBe('component');
  });

  it('“made” gives a label with the use-by from the kitchen’s rule, initials and allergens', async () => {
    const sauce = await recipe('Beurre blanc', 'butter 250g');
    await updateIngredient((await ingredient('Butter')).id, { allergens: ['milk'] }, db);
    await setShelfLife(kitchenId, { componentId: sauce }, '2 days', db);
    await setInitials('ls', db);
    const batch = await makeBatch(sauce, kitchenId, new Date(2026, 10, 25, 10, 0), db);
    const label = (await getBatchLabel(batch, db))!;
    expect(label).toMatchObject({ name: 'Beurre blanc', initials: 'LS' });
    expect(new Date(label.batch.useBy!)).toEqual(new Date(2026, 10, 27, 10, 0));
    expect(label.allergens.contains.map((c) => c.label)).toEqual(['Milk']);
  });

  it('no rule, no use-by: the app never invents a shelf life', async () => {
    const sauce = await recipe('Beurre blanc', 'butter 250g');
    const label = (await getBatchLabel(await makeBatch(sauce, kitchenId, new Date(), db), db))!;
    expect(label.batch.useBy).toBeNull();
    expect(label.shelfLife).toBeNull();
  });

  it('keeps the kitchen’s targets for critical points', async () => {
    await setTarget(kitchenId, 'cooling', 'below 5°C within 90 min', db);
    await setTarget(kitchenId, 'hot-hold', '', db);
    expect(await getTargets(kitchenId, db)).toEqual({ cooling: 'below 5°C within 90 min' });
  });
});

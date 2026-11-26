import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import type { MepDatabase } from './db';
import { createKitchen, setPlace } from './kitchens';
import { addComponentToDish, createComponent, createDish, getComponentDetails, getDishDetails, getVariationInUse, saveLines, setBaseYield, updateIngredient } from './library';
import { getDishNeeds, getScaleChoice, getScaledComponent, setQuantityPerPortion, setScaleChoice } from './scaling';
import { freshDatabase } from './testing';

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

async function recipe(name: string, lines: string, makes?: { amount: number; unit: string }) {
  const id = await createComponent(name, kitchenId, db);
  const variation = (await getVariationInUse(id, kitchenId, db))!;
  await saveLines(variation.id, parseShorthand(lines), db);
  if (makes) await setBaseYield(variation.id, makes, db);
  return id;
}

const amounts = (scaled: Awaited<ReturnType<typeof getScaledComponent>>) => scaled!.lines.map((l) => [l.name, l.scaled, l.estimate]);

describe('scaling a component', () => {
  it('by yield, rounded to what can be weighed', async () => {
    const id = await recipe('Beurre blanc', 'butter 250g, shallots 2, white wine 100ml, salt pinch', { amount: 500, unit: 'ml' });
    const scaled = await getScaledComponent(id, kitchenId, { by: 'yield', amount: 3, unit: 'l' }, db);
    expect(scaled!.factor).toBe(6);
    expect(scaled!.makes).toBe('3l');
    expect(amounts(scaled)).toEqual([
      ['Butter', '1.5kg', null],
      ['Shallots', '12', null],
      ['White wine', '600ml', null],
      ['Salt', '6 pinches', '¾ tsp'],
    ]);
  });

  it('from an anchor ingredient, crossing units with the ingredient’s weights', async () => {
    const id = await recipe('Batter', 'flour 300g, lager 1 pint, eggs 2');
    const details = (await getComponentDetails(id, kitchenId, db))!;
    const eggs = details.lines.find((l) => l.name === 'Eggs')!;
    const unknown = await getScaledComponent(id, kitchenId, { by: 'anchor', lineId: eggs.line.id, amount: 165, unit: 'g' }, db);
    expect(unknown!.factor).toBe(1);
    expect(unknown!.problem).toMatch(/can’t turn g into each for eggs/);

    await updateIngredient(eggs.line.ingredientId!, { unitWeights: { each: 55 } }, db);
    const scaled = await getScaledComponent(id, kitchenId, { by: 'anchor', lineId: eggs.line.id, amount: 165, unit: 'g' }, db);
    expect(scaled!.factor).toBeCloseTo(1.5);
    expect(amounts(scaled)).toEqual([
      ['Flour', '450g', null],
      ['Lager', '1½ pints', null],
      ['Eggs', '3', '165g'],
    ]);
  });

  it('never changes the stored recipe, and remembers the last choice', async () => {
    const id = await recipe('Stock', 'bones 2kg', { amount: 2, unit: 'l' });
    await setScaleChoice(id, { by: 'yield', amount: 5, unit: 'l' }, db);
    expect(await getScaleChoice(id, db)).toEqual({ by: 'yield', amount: 5, unit: 'l' });
    await getScaledComponent(id, kitchenId, await getScaleChoice(id, db), db);
    expect((await getComponentDetails(id, kitchenId, db))!.lines[0]!.line.quantity).toBe(2);
  });

  it('explains when it can’t scale by yield', async () => {
    const id = await recipe('Gel', 'beetroot 600g');
    expect((await getScaledComponent(id, kitchenId, { by: 'yield', amount: 1, unit: 'l' }, db))!.problem).toMatch(/Set what this recipe makes/);
  });

  it('passes the amount needed to a component used in this one', async () => {
    await recipe('Brown stock', 'bones 2kg', { amount: 2, unit: 'l' });
    const jus = await recipe('Jus', 'brown stock 2l, shallots 4', { amount: 500, unit: 'ml' });
    const scaled = await getScaledComponent(jus, kitchenId, { by: 'yield', amount: 1, unit: 'l' }, db);
    expect(scaled!.lines[0]!.component).toMatchObject({ amount: 4, unit: 'l' });
  });
});

describe('scaling a dish by portions', () => {
  it('works out each component for the covers, and says which have no amount per portion', async () => {
    const sauce = await recipe('Red wine sauce', 'red wine 750ml', { amount: 1, unit: 'l' });
    const puree = await recipe('Celeriac purée', 'celeriac 1kg');
    const dish = await createDish('Sirloin', null, db);
    await addComponentToDish(dish, sauce, db);
    await addComponentToDish(dish, puree, db);
    const links = (await getDishDetails(dish, db))!.components;
    await setQuantityPerPortion(links[0]!.link.id, { amount: 30, unit: 'ml' }, db);
    const needs = await getDishNeeds(dish, kitchenId, 40, db);
    expect(needs.map((n) => [n.component.name, n.needed])).toEqual([
      ['Red wine sauce', '1.2l'],
      ['Celeriac purée', null],
    ]);
  });
});

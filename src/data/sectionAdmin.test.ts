import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import { addChecklistItem, getChecklist, getRun, toggleTick } from './checklists';
import { componentCost, dishCost, menuGps } from './costing';
import type { MepDatabase } from './db';
import { alsoUsedElsewhere } from './elsewhere';
import { createKitchen, listSections, setPlace } from './kitchens';
import { addComponentToDish, createComponent, createDish, getVariationInUse, saveLines, setBaseYield, updateIngredient } from './library';
import { addDishToMenu, createMenu, updateMenuDish } from './menus';
import { createProduct, ensureSupplier, updateProduct } from './products';
import { allergenMatrix, goalSuggestions, matrixCsv, weeklyReport } from './report';
import { setQuantityPerPortion } from './scaling';
import { addSectionItem, updateSectionItem } from './sectionItems';
import { getOrCreateSheet, getSheetView, writeNextSheetWithSummary } from './sheets';
import { draftOrders, getCountView, setCount } from './stock';
import { freshDatabase, loadSeed } from './testing';
import { logWaste } from './waste';

let db: MepDatabase;
let kitchenId: string;
let fish: string;
beforeEach(async () => {
  db = await freshDatabase();
  kitchenId = await createKitchen('Dumbleton Hall', db);
  await setPlace(kitchenId, db);
  fish = (await listSections(kitchenId, db)).find((s) => s.name === 'Fish')!.id;
});
afterEach(async () => {
  await db.delete();
});

const ingredient = async (name: string) => (await db.ingredients.toArray()).find((i) => i.name === name)!;
async function recipe(name: string, lines: string, makes: { amount: number; unit: string }) {
  const id = await createComponent(name, kitchenId, db);
  const variation = (await getVariationInUse(id, kitchenId, db))!;
  await saveLines(variation.id, parseShorthand(lines), db);
  await setBaseYield(variation.id, makes, db);
  return id;
}
async function price(name: string, pack: { amount: number; unit: string }, pence: number, supplierId: string | null = null) {
  const product = await createProduct((await ingredient(name)).id, kitchenId, `${name} co`, db);
  await updateProduct(product, { pack, price: pence, supplierId }, db);
  return product;
}

describe('costing (A1)', () => {
  it('costs a component through what it uses, a dish per portion, and GP against target', async () => {
    // Beurre blanc: 250 g butter (£8 for 2 kg = £1), 100 ml wine (£6 for 750 ml = 80p); makes 500 ml.
    const bb = await recipe('Beurre blanc', 'butter 250g, white wine 100ml', { amount: 500, unit: 'ml' });
    await price('Butter', { amount: 2, unit: 'kg' }, 800);
    await price('White wine', { amount: 750, unit: 'ml' }, 600);
    const cost = await componentCost(bb, kitchenId, db);
    expect(cost).toMatchObject({ batch: 180, missing: [] });
    expect(cost.perUnit).toBeCloseTo(0.36);

    // Cod: one portion (£3 a portion), plus 50 ml beurre blanc (18p).
    const cod = await recipe('Cod portions', 'cod 10', { amount: 10, unit: 'portion' });
    await price('Cod', { amount: 10, unit: 'each' }, 3000);
    const dish = await createDish('Cornish cod', db);
    await addComponentToDish(dish, cod, db);
    await addComponentToDish(dish, bb, db);
    const links = await db.dishComponents.where('dishId').equals(dish).sortBy('order');
    await setQuantityPerPortion(links[0]!.id, { amount: 1, unit: 'portion' }, db);
    await setQuantityPerPortion(links[1]!.id, { amount: 50, unit: 'ml' }, db);
    expect((await dishCost(dish, kitchenId, db)).perPortion).toBe(318);

    // £24 on the menu = £20 without VAT; £3.18 cost → 84.1% GP, below a 85% target.
    const menu = await createMenu(kitchenId, 'À la carte', {}, db);
    const place = await addDishToMenu(menu, dish, null, db);
    await updateMenuDish(place, { price: 2400, targetGpPercent: 85 }, db);
    const [gp] = await menuGps(kitchenId, undefined, db);
    expect(gp).toMatchObject({ gp: 84.1, belowTarget: true });
  });

  it('says what it couldn’t cost', async () => {
    const id = await recipe('Gremolata', 'parsley 1 bunch, lemon zest', { amount: 100, unit: 'g' });
    expect((await componentCost(id, kitchenId, db)).missing).toEqual(['parsley (no price)', 'lemon zest (no amount)']);
  });

  it('a price change moves the GP at once', async () => {
    const id = await recipe('Chips', 'potatoes 1kg', { amount: 4, unit: 'portion' });
    const product = await price('Potatoes', { amount: 25, unit: 'kg' }, 1000);
    const dish = await createDish('French fries', db);
    await addComponentToDish(dish, id, db);
    await setQuantityPerPortion((await db.dishComponents.where('dishId').equals(dish).first())!.id, { amount: 1, unit: 'portion' }, db);
    const menu = await createMenu(kitchenId, 'À la carte', {}, db);
    await updateMenuDish(await addDishToMenu(menu, dish, null, db), { price: 600, targetGpPercent: 80 }, db);
    const before = (await menuGps(kitchenId, undefined, db))[0]!.gp!;
    await updateProduct(product, { price: 5000 }, db);
    const after = (await menuGps(kitchenId, undefined, db))[0]!.gp!;
    expect(after).toBeLessThan(before);
  });
});

describe('counts, orders and the next sheet (A2, A3, SH3)', () => {
  it('counts against pars, values stock, drafts an order by supplier and tops up the next sheet', async () => {
    const brakes = await ensureSupplier(kitchenId, 'Brakes', db);
    await db.suppliers.update(brakes, { cutOff: '14:00 the day before' });
    await recipe('Beurre blanc', 'butter 250g', { amount: 500, unit: 'ml' });
    await price('Butter', { amount: 2.5, unit: 'kg' }, 1000, brakes);
    const butterItem = await addSectionItem(fish, { ingredientId: (await ingredient('Butter')).id }, db);
    await updateSectionItem(butterItem, { par: { amount: 5, unit: 'kg' } }, db);
    const bbItem = await addSectionItem(fish, { componentId: (await db.components.toArray())[0]!.id }, db);
    await updateSectionItem(bbItem, { par: { amount: 2, unit: 'l' } }, db);

    await setCount(fish, butterItem, { amount: 1.5, unit: 'kg' }, '2026-11-25', db);
    await setCount(fish, bbItem, { amount: 0.5, unit: 'l' }, '2026-11-25', db);
    const view = await getCountView(fish, kitchenId, new Date(2026, 10, 25), db);
    expect(view.rows.map((r) => [r.view.name, r.short])).toEqual([
      ['Butter', 3.5],
      ['Beurre blanc', 1.5],
    ]);
    // 1.5 kg butter at £4/kg = £6, and 500 ml beurre blanc (£1 of butter) = £7.
    expect(view.value.pence).toBe(700);

    const [order] = await draftOrders(kitchenId, db);
    expect(order!.supplier?.name).toBe('Brakes');
    expect(order!.lines).toEqual([expect.objectContaining({ ingredientName: 'Butter', packs: 2, cost: 2000 })]);

    const today = await getOrCreateSheet(kitchenId, '2026-11-25', [], db);
    const next = await writeNextSheetWithSummary(today, '2026-11-26', db);
    expect(next.toppedUp).toBe(1);
    const nextView = (await getSheetView(next.id, kitchenId, db))!;
    expect(nextView.items.map((i) => [i.name, i.amount])).toEqual([['Beurre blanc', 'top up to 2l']]);
    // Writing it again adds nothing twice.
    expect((await writeNextSheetWithSummary(today, '2026-11-26', db)).toppedUp).toBe(0);
  });
});

describe('checklists (A6)', () => {
  it('ticks items for today, kept day by day', async () => {
    const first = await addChecklistItem(fish, 'open', 'Fridge temps logged', db);
    await addChecklistItem(fish, 'open', 'Boards out', db);
    const list = await getChecklist(fish, 'open', db);
    await toggleTick(list.id, first, new Date(2026, 10, 25, 9), db);
    expect((await getRun(list.id, '2026-11-25', db))!.ticked.map((t) => t.itemId)).toEqual([first]);
    expect(await getRun(list.id, '2026-11-26', db)).toBeUndefined();
    await toggleTick(list.id, first, new Date(2026, 10, 25, 9, 5), db);
    expect((await getRun(list.id, '2026-11-25', db))!.ticked).toEqual([]);
  });
});

describe('also used elsewhere (A9)', () => {
  it('finds the overlaps in Dumbleton Hall’s real menus', async () => {
    const seedKitchen = await loadSeed(db);
    const find = async (name: string) => {
      const component = (await db.components.toArray()).find((c) => c.name.toLowerCase() === name.toLowerCase())!;
      return alsoUsedElsewhere(component.id, seedKitchen, db);
    };
    // Walnut is on the à la carte terrine and Sunday lunch duck.
    expect((await find('walnut')).map((a) => a.uses)).toEqual([['Sunday lunch: merryfield duck', 'À la carte: pressed chicken terrine']].map((u) => u.sort()));
    // French fries: the side and with the ribeye.
    expect((await find('french fries'))[0]!.uses).toHaveLength(2);
  });

  it('notes a shared ingredient, but never guesses stock', async () => {
    const trout = await recipe('Cured trout', 'chalk stream trout 2', { amount: 20, unit: 'portion' });
    const smoked = await recipe('Smoked trout', 'chalk stream trout 1', { amount: 10, unit: 'portion' });
    const breakfast = await createMenu(kitchenId, 'Breakfast', {}, db);
    const royale = await createDish('Eggs royale', db);
    await addComponentToDish(royale, smoked, db);
    await addDishToMenu(breakfast, royale, null, db);
    expect(await alsoUsedElsewhere(trout, kitchenId, db)).toEqual([{ name: 'Chalk stream trout', uses: ['Breakfast: eggs royale'] }]);
  });
});

describe('reports (A5, A8, G1)', () => {
  it('an allergen matrix marked as a working copy', async () => {
    const bb = await recipe('Beurre blanc', 'butter 250g', { amount: 500, unit: 'ml' });
    await updateIngredient((await ingredient('Butter')).id, { allergens: ['milk'] }, db);
    const dish = await createDish('Cornish cod', db);
    await addComponentToDish(dish, bb, db);
    const menu = await createMenu(kitchenId, 'À la carte', {}, db);
    await addDishToMenu(menu, dish, null, db);
    const rows = await allergenMatrix(menu, kitchenId, db);
    expect(rows[0]).toMatchObject({ dish: 'Cornish cod', complete: true });
    expect(rows[0]!.cells.milk).toBe('Y');
    const csv = matrixCsv(rows, 'À la carte', '2026-11-25');
    expect(csv.split('\n')[0]).toContain('WORKING COPY');
    expect(csv.split('\n')[2]).toContain('Cornish cod');
  });

  it('a weekly report and goal suggestions from waste', async () => {
    await recipe('Beurre blanc', 'butter 250g', { amount: 500, unit: 'ml' });
    await price('Butter', { amount: 1, unit: 'kg' }, 800);
    const overPrep = (await db.listValues.where('list').equals('waste-reasons').toArray()).find((v) => v.value === 'Over-prep')!.id;
    await logWaste({ text: 'beurre blanc', quantity: { amount: 1, unit: 'l' }, reasonId: overPrep }, new Date(2026, 10, 18), db);
    const report = await weeklyReport(kitchenId, new Date(2026, 10, 18), db);
    // 1 l of beurre blanc = 2 batches of 250 g butter = £4.
    expect(report.waste).toMatchObject({ entries: 1, pence: 400, byReason: [{ reason: 'Over-prep', pence: 400, entries: 1 }] });
    const suggestions = await goalSuggestions(kitchenId, new Date(2026, 10, 25), db);
    expect(suggestions[0]).toEqual({ text: 'Halve the beurre blanc waste', from: '£4.00 of it wasted last week' });
  });
});

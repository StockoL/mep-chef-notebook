import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import type { MepDatabase } from './db';
import { addDishToSheet, gatherDishAllergens } from './dishes';
import { createKitchen, setPlace } from './kitchens';
import { addComponentToDish, createComponent, createDish, createIngredient, getVariationInUse, saveLines, updateIngredient } from './library';
import { getListItems } from './lists';
import {
  addDishToMenu,
  copyMenu,
  createMenu,
  deleteMenu,
  getMenuView,
  launchMenu,
  listMenus,
  menuComponentsForSection,
  menusForComponent,
  menusForDish,
  setComponentSection,
  tagSuggestions,
  updateMenuDish,
} from './menus';
import { getSheetView } from './sheets';
import { restoreSnapshot } from './snapshot';
import { freshDatabase } from './testing';

let db: MepDatabase;
let kitchenId: string;
let course: (name: string) => Promise<string>;
let section: (name: string) => Promise<string>;
beforeEach(async () => {
  db = await freshDatabase();
  kitchenId = await createKitchen('Dumbleton Hall', db);
  await setPlace(kitchenId, db);
  course = async (name) => (await getListItems({ kind: 'values', list: 'courses', kitchenId }, db)).find((c) => c.name === name)!.id;
  section = async (name) => (await db.sections.where('kitchenId').equals(kitchenId).toArray()).find((s) => s.name === name)!.id;
});
afterEach(async () => {
  await db.delete();
});

async function dish(name: string, components: string[]) {
  const dishId = await createDish(name, db);
  const ids: string[] = [];
  for (const c of components) {
    const id = await createComponent(c, kitchenId, db);
    await addComponentToDish(dishId, id, db);
    ids.push(id);
  }
  return { dishId, componentIds: ids };
}

describe('menus (MS1)', () => {
  it('shows dishes by course, the sections each touches, what’s mine, and readiness', async () => {
    const menu = await createMenu(kitchenId, 'À la carte', {}, db);
    const cod = await dish('Cornish cod', ['Cod portions', 'Charred leek']);
    const carrot = await dish('Heritage carrot', ['Roast carrots']);
    const codPlace = await addDishToMenu(menu, cod.dishId, await course('Mains'), db);
    await addDishToMenu(menu, carrot.dishId, await course('Mains'), db);
    await updateMenuDish(codPlace, { price: 3900, targetGpPercent: 72 }, db);
    await setComponentSection(codPlace, cod.componentIds[0]!, await section('Fish'), db);
    await setComponentSection(codPlace, cod.componentIds[1]!, await section('Veg'), db);
    // One component's recipe is ready.
    const variation = (await getVariationInUse(cod.componentIds[0]!, kitchenId, db))!;
    await db.variations.update(variation.id, { status: 'ready' });

    const view = (await getMenuView(menu, [await section('Fish')], db))!;
    expect(view.courses.map((c) => [c.name, c.dishes.map((d) => d.dish.name)])).toEqual([['Mains', ['Cornish cod', 'Heritage carrot']]]);
    const codView = view.courses[0]!.dishes[0]!;
    expect(codView).toMatchObject({ sectionNames: ['Fish', 'Veg'], mine: true, place: { price: 3900, targetGpPercent: 72 } });
    expect(view.courses[0]!.dishes[1]!.mine).toBe(false);
    expect(view.readiness).toEqual({ ready: 1, total: 3 });
    expect((await menusForDish(cod.dishId, db)).map((m) => m.menu.name)).toEqual(['À la carte']);
    expect((await menusForComponent(cod.componentIds[1]!, db)).map((m) => m.name)).toEqual(['À la carte']);
  });

  it('deletes a menu with undo, keeping its dishes', async () => {
    const menu = await createMenu(kitchenId, 'Sunday lunch', {}, db);
    const roast = await dish('Roast beef', ['Yorkshire pudding']);
    await addDishToMenu(menu, roast.dishId, null, db);
    const snapshot = await deleteMenu(menu, db);
    expect(await listMenus(kitchenId, db)).toEqual([]);
    expect(await db.dishes.get(roast.dishId)).toBeDefined();
    await restoreSnapshot(snapshot, db);
    expect((await getMenuView(menu, [], db))!.courses[0]!.name).toBe('No course yet');
  });
});

describe('changeover (MS4)', () => {
  it('copies the current menu as coming up, then launch moves the old one to past', async () => {
    const autumn = await createMenu(kitchenId, 'Autumn', {}, db);
    const cod = await dish('Cornish cod', ['Cod portions']);
    const place = await addDishToMenu(autumn, cod.dishId, await course('Mains'), db);
    await setComponentSection(place, cod.componentIds[0]!, await section('Fish'), db);

    const winter = await copyMenu(autumn, 'Winter', db);
    expect(await db.menus.get(winter)).toMatchObject({ status: 'coming-up', copiedFromId: autumn });
    const copied = (await getMenuView(winter, [], db))!;
    expect(copied.courses[0]!.dishes[0]!.sectionNames).toEqual(['Fish']);

    const before = await launchMenu(winter, [autumn], '2026-12-01', db);
    expect(await db.menus.get(winter)).toMatchObject({ status: 'on-now', starts: '2026-12-01' });
    expect(await db.menus.get(autumn)).toMatchObject({ status: 'past', ends: '2026-12-01' });
    expect((await listMenus(kitchenId, db)).map((m) => m.name)).toEqual(['Winter', 'Autumn']);
    expect(before).toHaveLength(2);
  });

  it('builds the section list from menus on now', async () => {
    const menu = await createMenu(kitchenId, 'À la carte', {}, db);
    const cod = await dish('Cornish cod', ['Cod portions', 'Charred leek']);
    const place = await addDishToMenu(menu, cod.dishId, null, db);
    await setComponentSection(place, cod.componentIds[0]!, await section('Fish'), db);
    expect((await menuComponentsForSection(await section('Fish'), db)).map((c) => [c.component.name, c.menuNames])).toEqual([['Cod portions', ['À la carte']]]);
    const next = await createMenu(kitchenId, 'Spring', { status: 'coming-up' }, db);
    const p2 = await addDishToMenu(next, cod.dishId, null, db);
    await setComponentSection(p2, cod.componentIds[1]!, await section('Fish'), db);
    expect(await menuComponentsForSection(await section('Fish'), db)).toHaveLength(1);
  });
});

describe('dishes at work (MS2, R3)', () => {
  it('suggests tags from menus and courses', async () => {
    const menu = await createMenu(kitchenId, 'À la carte', { typeId: (await getListItems({ kind: 'values', list: 'menu-types', kitchenId }, db))[0]!.id }, db);
    const cod = await dish('Cornish cod', ['Cod portions']);
    await addDishToMenu(menu, cod.dishId, await course('Mains'), db);
    expect(await tagSuggestions({ kind: 'dish', id: cod.dishId }, db)).toEqual(['À la carte', 'Mains']);
    expect(await tagSuggestions({ kind: 'component', id: cod.componentIds[0]! }, db)).toEqual(['À la carte', 'Mains']);
  });

  it('gathers allergens through components, and says what isn’t confirmed', async () => {
    const sauce = await createComponent('Beurre blanc', kitchenId, db);
    const sauceVariation = (await getVariationInUse(sauce, kitchenId, db))!;
    await saveLines(sauceVariation.id, parseShorthand('butter 250g, shallots 2'), db);
    const butter = (await db.ingredients.toArray()).find((i) => i.name === 'Butter')!;
    await updateIngredient(butter.id, { allergens: ['milk'] }, db);
    const mayo = await createIngredient('Mayonnaise', db);
    await updateIngredient(mayo, { kind: 'bought-in' }, db);
    const garnish = await createComponent('Tartare', kitchenId, db);
    await saveLines((await getVariationInUse(garnish, kitchenId, db))!.id, parseShorthand('mayonnaise 100g, beurre blanc 50ml'), db);

    const dishId = await createDish('Cod', db);
    await addComponentToDish(dishId, garnish, db);
    expect(await gatherDishAllergens(dishId, kitchenId, db)).toEqual({ contains: [{ id: 'milk', label: 'Milk' }], unconfirmed: ['Mayonnaise'] });
  });

  it('puts the components on today’s sheet, with amounts for a number of portions', async () => {
    const cod = await dish('Cornish cod', ['Cod portions', 'Charred leek']);
    const { setQuantityPerPortion } = await import('./scaling');
    const links = await db.dishComponents.where('dishId').equals(cod.dishId).sortBy('order');
    await setQuantityPerPortion(links[0]!.id, { amount: 1, unit: 'portion' }, db);
    const { sheetId, added } = await addDishToSheet(cod.dishId, 20, db);
    expect(added).toBe(2);
    const view = (await getSheetView(sheetId, kitchenId, db))!;
    expect(view.items.map((v) => [v.name, v.amount])).toEqual([
      ['Cod portions', '20 portions'],
      ['Charred leek', ''],
    ]);
  });
});

/** Helpers for data tests: a fresh, uniquely named database per test. */
import 'fake-indexeddb/auto';
import { MepDatabase, ensureBuiltIns } from './db';
import { newId } from './ids';

export async function freshDatabase(): Promise<MepDatabase> {
  const database = new MepDatabase(`test-${newId()}`);
  await database.open();
  await ensureBuiltIns(database);
  return database;
}

/**
 * Loads seed/dumbleton-hall.json into a database: the kitchen, its menus by
 * course with each dish's named components (as draft components, one per
 * name), for tests against real menus. Returns the kitchen's id.
 */
export async function loadSeed(database: MepDatabase): Promise<string> {
  const { default: raw } = await import('../../seed/dumbleton-hall.json?raw');
  const seed = JSON.parse(raw) as {
    kitchen: { name: string };
    menus: { name: string; status: 'on-now' | 'coming-up' | 'past'; courses: { name: string; dishes: { name: string; price_pence?: number; components: string[] }[] }[] }[];
  };
  const { createKitchen } = await import('./kitchens');
  const { addComponentToDish, createComponent, createDish } = await import('./library');
  const { addDishToMenu, createMenu, updateMenuDish } = await import('./menus');
  const { addListItem, getListItems } = await import('./lists');
  const kitchenId = await createKitchen(seed.kitchen.name, database);
  const components = new Map<string, string>();
  for (const menu of seed.menus) {
    const menuId = await createMenu(kitchenId, menu.name, { status: menu.status }, database);
    for (const course of menu.courses) {
      const ref = { kind: 'values' as const, list: 'courses' as const, kitchenId };
      const courseId = (await getListItems(ref, database)).find((c) => c.name === course.name)?.id ?? (await addListItem(ref, course.name, database));
      for (const dish of course.dishes) {
        const dishId = await createDish(dish.name, database);
        for (const name of dish.components) {
          const key = name.toLowerCase();
          if (!components.has(key)) components.set(key, await createComponent(name.charAt(0).toUpperCase() + name.slice(1), kitchenId, database));
          await addComponentToDish(dishId, components.get(key)!, database);
        }
        const placeId = await addDishToMenu(menuId, dishId, courseId, database);
        if (dish.price_pence) await updateMenuDish(placeId, { price: dish.price_pence }, database);
      }
    }
  }
  return kitchenId;
}

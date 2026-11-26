/**
 * Working out an older dish's kitchen (schema v8, DECISIONS 54). Pure: used
 * by the database upgrade (db.ts) on the rows being upgraded, and after
 * importing an older export (dishOrigin.ts → fillMissingDishKitchens).
 */

import { NO_KITCHEN_ID, type Dish, type DishComponent, type Id, type KitchenId, type Menu, type MenuDish, type Variation } from './types';

const realKitchen = (kitchenId: KitchenId | null | undefined): KitchenId | null => (kitchenId && kitchenId !== NO_KITCHEN_ID ? kitchenId : null);

/**
 * Each dish's kitchen, from its rows: the kitchen of the first menu it went
 * on; otherwise the kitchen most of its components' house recipes are from;
 * otherwise null (the chef's own).
 */
export function inferDishKitchens(rows: {
  dishes: Pick<Dish, 'id'>[];
  menus: Pick<Menu, 'id' | 'kitchenId' | 'createdAt'>[];
  menuDishes: Pick<MenuDish, 'menuId' | 'dishId'>[];
  dishComponents: Pick<DishComponent, 'dishId' | 'componentId'>[];
  variations: Pick<Variation, 'componentId' | 'source' | 'kitchenId'>[];
}): Map<Id, KitchenId | null> {
  const menus = new Map(rows.menus.map((m) => [m.id, m]));
  const out = new Map<Id, KitchenId | null>();
  for (const dish of rows.dishes) {
    const onMenus = rows.menuDishes
      .filter((p) => p.dishId === dish.id)
      .map((p) => menus.get(p.menuId))
      .filter((m): m is NonNullable<typeof m> => Boolean(m && realKitchen(m.kitchenId)))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (onMenus[0]) {
      out.set(dish.id, onMenus[0].kitchenId);
      continue;
    }
    const counts = new Map<KitchenId, number>();
    for (const link of rows.dishComponents.filter((l) => l.dishId === dish.id)) {
      for (const v of rows.variations) {
        const kitchen = v.componentId === link.componentId && v.source === 'house' ? realKitchen(v.kitchenId) : null;
        if (kitchen) counts.set(kitchen, (counts.get(kitchen) ?? 0) + 1);
      }
    }
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    out.set(dish.id, best ? best[0] : null);
  }
  return out;
}

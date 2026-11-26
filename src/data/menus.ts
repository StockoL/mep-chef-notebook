/**
 * Menus (SPEC → Menus and dishes, Changeover; MS1, MS2, MS4; DECISIONS 47).
 *
 * A menu belongs to a kitchen and lists dishes by course, each with a price,
 * a target GP% and which section makes each of its components. A dish is
 * linked to menus, not owned by one. Changeover: copy the current menu into
 * a coming-up one, watch its readiness, then launch it (the old one moves to
 * past; nothing is deleted).
 */

import { toCalendarDate } from '../core/time/calendar';
import { cleanName } from '../core/lists/lists';
import { db as appDb, type MepDatabase } from './db';
import { getVariationInUse } from './library';
import { getListItems, ListError } from './lists';
import type { Snapshot } from './snapshot';
import type { CalendarDate, Component, Dish, Id, KitchenId, Menu, MenuDish, MenuStatus } from './types';

// ─── Menus ────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<MenuStatus, number> = { 'on-now': 0, 'coming-up': 1, past: 2 };

/** A kitchen's menus: on now, then coming up, then past (newest first). */
export async function listMenus(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Menu[]> {
  const menus = await database.menus.where('kitchenId').equals(kitchenId).toArray();
  return menus.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name));
}

export function getMenu(id: Id, database: MepDatabase = appDb) {
  return database.menus.get(id);
}

export async function createMenu(
  kitchenId: KitchenId,
  name: string,
  options: { typeId?: Id | null; status?: MenuStatus; days?: number[]; serviceIds?: Id[] } = {},
  database: MepDatabase = appDb,
): Promise<Id> {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the menu a name.');
  return database.menus.add({
    kitchenId,
    name: cleaned,
    typeId: options.typeId ?? null,
    status: options.status ?? 'on-now',
    starts: null,
    ends: null,
    copiedFromId: null,
    days: options.days ?? [],
    serviceIds: options.serviceIds ?? [],
  });
}

export async function updateMenu(
  id: Id,
  changes: Partial<Pick<Menu, 'name' | 'typeId' | 'status' | 'starts' | 'ends' | 'days' | 'serviceIds'>>,
  database: MepDatabase = appDb,
) {
  if (changes.name !== undefined) {
    const name = cleanName(changes.name);
    if (!name) throw new ListError('Give the menu a name.');
    changes = { ...changes, name };
  }
  await database.menus.update(id, changes);
}

/** Deletes a menu and its dish places (never the dishes). Returns a snapshot for Undo. */
export async function deleteMenu(id: Id, database: MepDatabase = appDb): Promise<Snapshot> {
  return database.transaction('rw', [database.menus, database.menuDishes, database.menuSectionAssignments], async () => {
    const menu = await database.menus.get(id);
    const menuDishes = await database.menuDishes.where('menuId').equals(id).toArray();
    const assignments = await database.menuSectionAssignments.where('menuDishId').anyOf(menuDishes.map((d) => d.id)).toArray();
    await database.menus.delete(id);
    await database.menuDishes.bulkDelete(menuDishes.map((d) => d.id));
    await database.menuSectionAssignments.bulkDelete(assignments.map((a) => a.id));
    return { menus: menu ? [menu] : [], menuDishes, menuSectionAssignments: assignments };
  });
}

/**
 * New season (MS4): a coming-up copy of a menu with the same dishes,
 * courses, prices and section assignments, to edit what's new. Returns its id.
 */
export async function copyMenu(id: Id, name: string, database: MepDatabase = appDb): Promise<Id> {
  return database.transaction('rw', [database.menus, database.menuDishes, database.menuSectionAssignments], async () => {
    const from = await database.menus.get(id);
    if (!from) throw new Error('That menu no longer exists.');
    const cleaned = cleanName(name) || `${from.name} (new)`;
    const copyId = await database.menus.add({ kitchenId: from.kitchenId, name: cleaned, typeId: from.typeId, status: 'coming-up', starts: null, ends: null, copiedFromId: from.id, days: from.days ?? [], serviceIds: from.serviceIds ?? [] });
    for (const { id: oldId, createdAt: _c, updatedAt: _u, ...menuDish } of await database.menuDishes.where('menuId').equals(id).toArray()) {
      const newId = await database.menuDishes.add({ ...menuDish, menuId: copyId });
      for (const { id: _id, createdAt: _c2, updatedAt: _u2, ...assignment } of await database.menuSectionAssignments.where('menuDishId').equals(oldId).toArray()) {
        await database.menuSectionAssignments.add({ ...assignment, menuDishId: newId });
      }
    }
    return copyId;
  });
}

/**
 * Launch day (MS4): the menu goes on now from today, and the menus it
 * replaces move to past, ending today. Returns the old statuses for Undo.
 */
export async function launchMenu(id: Id, replacesIds: Id[], today: CalendarDate = toCalendarDate(new Date()), database: MepDatabase = appDb): Promise<Menu[]> {
  return database.transaction('rw', database.menus, async () => {
    const before = (await database.menus.bulkGet([id, ...replacesIds])).filter((m) => m !== undefined);
    const menu = before.find((m) => m.id === id);
    await database.menus.update(id, { status: 'on-now', starts: menu?.starts ?? today });
    for (const old of before.filter((m) => m.id !== id)) await database.menus.update(old.id, { status: 'past', ends: old.ends ?? today });
    return before;
  });
}

export async function restoreMenus(menus: Menu[], database: MepDatabase = appDb) {
  await database.menus.bulkPut(menus);
}

// ─── Dishes on a menu ─────────────────────────────────────────────────────

/** Puts a dish on a menu at the end of a course (once). Returns the place's id. */
export async function addDishToMenu(menuId: Id, dishId: Id, courseId: Id | null, database: MepDatabase = appDb): Promise<Id> {
  const places = await database.menuDishes.where('menuId').equals(menuId).toArray();
  const existing = places.find((p) => p.dishId === dishId);
  if (existing) return existing.id;
  return database.menuDishes.add({
    menuId,
    dishId,
    courseId,
    order: places.reduce((max, p) => Math.max(max, p.order + 1), 0),
    price: null,
    targetGpPercent: null,
  });
}

export async function updateMenuDish(id: Id, changes: Partial<Pick<MenuDish, 'courseId' | 'price' | 'targetGpPercent'>>, database: MepDatabase = appDb) {
  await database.menuDishes.update(id, changes);
}

/** Moves a dish up or down within its course. */
export async function moveMenuDish(id: Id, direction: -1 | 1, database: MepDatabase = appDb) {
  await database.transaction('rw', database.menuDishes, async () => {
    const place = await database.menuDishes.get(id);
    if (!place) return;
    const course = (await database.menuDishes.where('menuId').equals(place.menuId).toArray())
      .filter((p) => p.courseId === place.courseId)
      .sort((a, b) => a.order - b.order);
    const index = course.findIndex((p) => p.id === id);
    const other = course[index + direction];
    if (!other) return;
    await database.menuDishes.update(id, { order: other.order });
    await database.menuDishes.update(other.id, { order: place.order });
  });
}

/** Takes a dish off a menu (the dish stays). Returns a snapshot for Undo. */
export async function removeDishFromMenu(id: Id, database: MepDatabase = appDb): Promise<Snapshot> {
  return database.transaction('rw', database.menuDishes, database.menuSectionAssignments, async () => {
    const place = await database.menuDishes.get(id);
    const assignments = await database.menuSectionAssignments.where('menuDishId').equals(id).toArray();
    await database.menuDishes.delete(id);
    await database.menuSectionAssignments.bulkDelete(assignments.map((a) => a.id));
    return { menuDishes: place ? [place] : [], menuSectionAssignments: assignments };
  });
}

/** Which section makes this component of a dish on this menu; null clears it. */
export async function setComponentSection(menuDishId: Id, componentId: Id, sectionId: Id | null, database: MepDatabase = appDb) {
  await database.transaction('rw', database.menuSectionAssignments, async () => {
    const existing = await database.menuSectionAssignments.where('menuDishId').equals(menuDishId).filter((a) => a.componentId === componentId).toArray();
    await database.menuSectionAssignments.bulkDelete(existing.map((a) => a.id));
    if (sectionId) await database.menuSectionAssignments.add({ menuDishId, componentId, sectionId });
  });
}

// ─── The menu view (MS1) ──────────────────────────────────────────────────

export interface MenuDishView {
  place: MenuDish;
  dish: Dish;
  /** Each component, with the section that makes it here and whether its recipe is ready. */
  components: { component: Component; sectionId: Id | null; ready: boolean }[];
  /** "Fish, Veg": the sections this dish touches. */
  sectionNames: string[];
  /** One of the chef's sections makes part of it. */
  mine: boolean;
}

export interface MenuView {
  menu: Menu;
  typeName: string | null;
  courses: { courseId: Id | null; name: string; dishes: MenuDishView[] }[];
  /** Components on the menu with a ready recipe, counted once each (MS4). */
  readiness: { ready: number; total: number };
}

/** A menu by course, with sections and readiness; `mySectionIds` marks what's mine. */
export async function getMenuView(menuId: Id, mySectionIds: Id[], database: MepDatabase = appDb): Promise<MenuView | undefined> {
  const menu = await database.menus.get(menuId);
  if (!menu) return undefined;
  const [places, courses, types, sections] = await Promise.all([
    database.menuDishes.where('menuId').equals(menuId).sortBy('order'),
    getListItems({ kind: 'values', list: 'courses', kitchenId: menu.kitchenId }, database),
    getListItems({ kind: 'values', list: 'menu-types', kitchenId: menu.kitchenId }, database),
    database.sections.where('kitchenId').equals(menu.kitchenId).toArray(),
  ]);
  const sectionNames = new Map(sections.map((s) => [s.id, s.name]));
  const assignments = await database.menuSectionAssignments.where('menuDishId').anyOf(places.map((p) => p.id)).toArray();
  const readyCache = new Map<Id, boolean>();
  const isReady = async (componentId: Id) => {
    if (!readyCache.has(componentId)) readyCache.set(componentId, (await getVariationInUse(componentId, menu.kitchenId, database))?.status === 'ready');
    return readyCache.get(componentId)!;
  };

  const views: MenuDishView[] = [];
  for (const place of places) {
    const dish = await database.dishes.get(place.dishId);
    if (!dish) continue;
    const links = await database.dishComponents.where('dishId').equals(dish.id).sortBy('order');
    const components = [];
    for (const link of links) {
      const component = await database.components.get(link.componentId);
      if (!component) continue;
      const sectionId = assignments.find((a) => a.menuDishId === place.id && a.componentId === component.id)?.sectionId ?? null;
      components.push({ component, sectionId, ready: await isReady(component.id) });
    }
    const touched = [...new Set(components.map((c) => c.sectionId).filter((id) => id !== null))];
    views.push({
      place,
      dish,
      components,
      sectionNames: touched.map((id) => sectionNames.get(id) ?? '?'),
      mine: touched.some((id) => mySectionIds.includes(id)),
    });
  }

  const byCourse: MenuView['courses'] = courses
    .map((course) => ({ courseId: course.id as Id | null, name: course.name, dishes: views.filter((v) => v.place.courseId === course.id) }))
    .filter((c) => c.dishes.length > 0);
  const unplaced = views.filter((v) => !v.place.courseId || !courses.some((c) => c.id === v.place.courseId));
  if (unplaced.length) byCourse.push({ courseId: null, name: 'No course yet', dishes: unplaced });

  return {
    menu,
    typeName: types.find((t) => t.id === menu.typeId)?.name ?? null,
    courses: byCourse,
    readiness: { ready: [...readyCache.values()].filter(Boolean).length, total: readyCache.size },
  };
}

/** The menus a dish is on, in any kitchen (SPEC: "a dish shows which menus it's been on"). */
export async function menusForDish(dishId: Id, database: MepDatabase = appDb): Promise<{ menu: Menu; place: MenuDish }[]> {
  const places = await database.menuDishes.where('dishId').equals(dishId).toArray();
  const menus = await database.menus.bulkGet(places.map((p) => p.menuId));
  return places.flatMap((place, i) => (menus[i] ? [{ menu: menus[i], place }] : [])).sort((a, b) => STATUS_ORDER[a.menu.status] - STATUS_ORDER[b.menu.status]);
}

/** The menus a component has been on, through its dishes. */
export async function menusForComponent(componentId: Id, database: MepDatabase = appDb): Promise<Menu[]> {
  const links = await database.dishComponents.where('componentId').equals(componentId).toArray();
  const places = await database.menuDishes.where('dishId').anyOf(links.map((l) => l.dishId)).toArray();
  const menus = (await database.menus.bulkGet([...new Set(places.map((p) => p.menuId))])).filter((m) => m !== undefined);
  return menus.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

// ─── Section lists from the menus (MS4) ───────────────────────────────────

export interface MenuComponentForSection {
  component: Component;
  /** "À la carte, Dessert". */
  menuNames: string[];
}

/** Components this section makes on the kitchen's menus on now. */
export async function menuComponentsForSection(sectionId: Id, database: MepDatabase = appDb): Promise<MenuComponentForSection[]> {
  const assignments = await database.menuSectionAssignments.where('sectionId').equals(sectionId).toArray();
  if (assignments.length === 0) return [];
  const places = (await database.menuDishes.bulkGet([...new Set(assignments.map((a) => a.menuDishId))])).filter((p) => p !== undefined);
  const menus = new Map((await database.menus.bulkGet([...new Set(places.map((p) => p.menuId))])).filter((m) => m !== undefined).map((m) => [m.id, m]));
  const found = new Map<Id, Set<string>>();
  for (const assignment of assignments) {
    const place = places.find((p) => p.id === assignment.menuDishId);
    const menu = place ? menus.get(place.menuId) : undefined;
    if (!menu || menu.status !== 'on-now') continue;
    found.set(assignment.componentId, (found.get(assignment.componentId) ?? new Set()).add(menu.name));
  }
  const components = (await database.components.bulkGet([...found.keys()])).filter((c) => c !== undefined);
  return components.map((component) => ({ component, menuNames: [...found.get(component.id)!] })).sort((a, b) => a.component.name.localeCompare(b.component.name));
}

// ─── Tag suggestions (R3) ─────────────────────────────────────────────────

/** Tags suggested from where a dish or component appears: its menus, courses and menu types. Only suggestions. */
export async function tagSuggestions(target: { kind: 'dish' | 'component'; id: Id }, database: MepDatabase = appDb): Promise<string[]> {
  const dishIds =
    target.kind === 'dish' ? [target.id] : (await database.dishComponents.where('componentId').equals(target.id).toArray()).map((l) => l.dishId);
  const places = await database.menuDishes.where('dishId').anyOf(dishIds).toArray();
  const menus = (await database.menus.bulkGet([...new Set(places.map((p) => p.menuId))])).filter((m) => m !== undefined);
  const values = new Map((await database.listValues.bulkGet([...places.map((p) => p.courseId ?? ''), ...menus.map((m) => m.typeId ?? '')])).filter((v) => v !== undefined).map((v) => [v.id, v.value]));
  const names = [...menus.map((m) => m.name), ...places.map((p) => values.get(p.courseId ?? '')), ...menus.map((m) => values.get(m.typeId ?? ''))];
  const unique = new Map<string, string>();
  for (const name of names) if (name) unique.set(name.toLowerCase(), name);
  return [...unique.values()];
}

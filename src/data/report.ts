/**
 * Reports from the section's working figures (SPEC → Section admin; A5, A8,
 * G1; DECISIONS 53):
 * - the allergen matrix: dishes × the 14, as a grid and a spreadsheet (CSV),
 *   marked as the chef's working copy (the house matrix rests on supplier
 *   spec sheets and the head chef's sign-off);
 * - the weekly section report: goal and how it went, stock value, waste and
 *   its causes, GP against target, items regularly short;
 * - goal suggestions from those patterns: the chef chooses.
 */

import { ALLERGENS, type AllergenId } from '../core/allergens/allergens';
import { formatPence } from '../core/costing/costing';
import { shortOfPar } from '../core/stock/stock';
import { isoWeek, toCalendarDate } from '../core/time/calendar';
import { dishAllergens } from './allergens';
import { itemCost, menuGps, type MenuDishGp } from './costing';
import { db as appDb, type MepDatabase } from './db';
import { getGoal } from './goals';
import { getListItems } from './lists';
import { listSectionItems } from './sectionItems';
import { getCountView } from './stock';
import type { CalendarDate, Id, KitchenId, WeeklyGoal } from './types';

// ─── The allergen matrix (A5) ─────────────────────────────────────────────

/** "Y" contains, "May" may contain, "?" not confirmed, "" none recorded. */
export type MatrixCell = 'Y' | 'May' | '?' | '';

export interface MatrixRow {
  dish: string;
  course: string;
  cells: Record<AllergenId, MatrixCell>;
  /** Sub-types named, by allergen: "hazelnut". */
  detail: Partial<Record<AllergenId, string>>;
  complete: boolean;
}

/** A menu's dishes × the 14 allergens. */
export async function allergenMatrix(menuId: Id, kitchenId: KitchenId, database: MepDatabase = appDb): Promise<MatrixRow[]> {
  const menu = await database.menus.get(menuId);
  if (!menu) return [];
  const courses = new Map((await getListItems({ kind: 'values', list: 'courses', kitchenId: menu.kitchenId }, database)).map((c) => [c.id, c]));
  const places = (await database.menuDishes.where('menuId').equals(menuId).toArray()).sort(
    (a, b) => (courses.get(a.courseId ?? '')?.order ?? 99) - (courses.get(b.courseId ?? '')?.order ?? 99) || a.order - b.order,
  );
  const rows: MatrixRow[] = [];
  for (const place of places) {
    const dish = await database.dishes.get(place.dishId);
    if (!dish) continue;
    const allergens = await dishAllergens(dish.id, kitchenId, database);
    const cells = Object.fromEntries(ALLERGENS.map((a) => [a.id, (allergens.complete ? '' : '?') as MatrixCell])) as Record<AllergenId, MatrixCell>;
    const detail: Partial<Record<AllergenId, string>> = {};
    for (const m of allergens.mayContain) cells[m.allergen] = 'May';
    for (const c of allergens.contains) {
      cells[c.allergen] = 'Y';
      if (c.subTypes.length) detail[c.allergen] = c.subTypes.join(', ');
    }
    rows.push({ dish: dish.name, course: courses.get(place.courseId ?? '')?.name ?? '', cells, detail, complete: allergens.complete });
  }
  return rows;
}

const csvField = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** The matrix as a spreadsheet, headed as a working copy. */
export function matrixCsv(rows: readonly MatrixRow[], title: string, date: CalendarDate): string {
  const head = [`${title}: allergen matrix, WORKING COPY ${date}. Check against the house matrix, supplier spec sheets and head chef sign-off.`];
  const header = ['Course', 'Dish', ...ALLERGENS.map((a) => a.label), 'All confirmed'];
  const body = rows.map((r) => [
    r.course,
    r.dish,
    ...ALLERGENS.map((a) => (r.cells[a.id] === 'Y' && r.detail[a.id] ? `Y (${r.detail[a.id]})` : r.cells[a.id])),
    r.complete ? 'Yes' : 'NO',
  ]);
  return [head, header, ...body].map((line) => line.map(csvField).join(',')).join('\n');
}

// ─── The weekly report (A8) ───────────────────────────────────────────────

/** Monday to Sunday of the week a date is in. */
export function weekOf(date: Date): { start: CalendarDate; end: CalendarDate; week: string } {
  const day = (date.getDay() + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: toCalendarDate(monday), end: toCalendarDate(sunday), week: isoWeek(date) };
}

export interface WeeklyReport {
  week: string;
  start: CalendarDate;
  end: CalendarDate;
  kitchenName: string;
  goal: WeeklyGoal | undefined;
  stock: { section: string; pence: number; uncosted: number; date: CalendarDate | null }[];
  waste: { entries: number; pence: number; uncosted: number; byReason: { reason: string; pence: number; entries: number }[]; topItems: { name: string; pence: number }[] };
  gp: MenuDishGp[];
  /** Short of par at two or more counts this week. */
  oftenShort: { name: string; times: number }[];
}

export async function weeklyReport(kitchenId: KitchenId, now = new Date(), database: MepDatabase = appDb): Promise<WeeklyReport> {
  const { start, end, week } = weekOf(now);
  const kitchen = await database.kitchens.get(kitchenId);
  const sections = (await database.sections.where('kitchenId').equals(kitchenId).toArray()).filter((s) => !s.hidden && !s.mergedIntoId);

  const stock = [];
  const oftenShort: { name: string; times: number }[] = [];
  for (const section of sections) {
    const view = await getCountView(section.id, kitchenId, now, database);
    if (view.date) stock.push({ section: section.name, pence: view.value.pence, uncosted: view.value.uncosted.length, date: view.date });
    const counts = (await database.stockCounts.where('sectionId').equals(section.id).toArray()).filter((c) => c.date >= start && c.date <= end);
    for (const item of await listSectionItems(section.id, database)) {
      const times = counts.filter((c) => (shortOfPar({ par: item.item.par, count: c.counts.find((x) => x.sectionItemId === item.item.id)?.quantity ?? null }) ?? 0) > 0).length;
      if (times >= 2) oftenShort.push({ name: item.name, times });
    }
  }

  const reasons = new Map((await database.listValues.where('list').equals('waste-reasons').toArray()).map((r) => [r.id, r.value]));
  const entries = (await database.wasteEntries.where('kitchenId').equals(kitchenId).toArray()).filter((w) => w.date >= start && w.date <= end);
  const byReason = new Map<string, { pence: number; entries: number }>();
  const byItem = new Map<string, number>();
  let pence = 0;
  let uncosted = 0;
  for (const entry of entries) {
    const cost = entry.quantity ? await itemCost({ componentId: entry.componentId, ingredientId: entry.ingredientId }, entry.quantity, kitchenId, database) : null;
    const reason = (entry.reasonId && reasons.get(entry.reasonId)) || 'No reason';
    const r = byReason.get(reason) ?? { pence: 0, entries: 0 };
    r.entries += 1;
    if (cost === null) uncosted += 1;
    else {
      pence += cost;
      r.pence += cost;
      const name = entry.text ?? (entry.componentId ? (await database.components.get(entry.componentId))?.name : entry.ingredientId ? (await database.ingredients.get(entry.ingredientId))?.name : undefined) ?? 'Something';
      byItem.set(name, (byItem.get(name) ?? 0) + cost);
    }
    byReason.set(reason, r);
  }

  return {
    week,
    start,
    end,
    kitchenName: kitchen?.name ?? '',
    goal: await getGoal(week, database),
    stock,
    waste: {
      entries: entries.length,
      pence,
      uncosted,
      byReason: [...byReason.entries()].map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.pence - a.pence || b.entries - a.entries),
      topItems: [...byItem.entries()].map(([name, p]) => ({ name, pence: p })).sort((a, b) => b.pence - a.pence).slice(0, 5),
    },
    gp: await menuGps(kitchenId, undefined, database),
    oftenShort: oftenShort.sort((a, b) => b.times - a.times),
  };
}

// ─── Goal suggestions (G1) ────────────────────────────────────────────────

/** Goals the week's patterns suggest. Only suggestions: the chef writes or chooses the goal. */
export async function goalSuggestions(kitchenId: KitchenId, now = new Date(), database: MepDatabase = appDb): Promise<{ text: string; from: string }[]> {
  const report = await weeklyReport(kitchenId, new Date(now.getTime() - 7 * 86_400_000), database);
  const out: { text: string; from: string }[] = [];
  const topWaste = report.waste.topItems[0];
  if (topWaste && topWaste.pence >= 100) out.push({ text: `Halve the ${topWaste.name.toLowerCase()} waste`, from: `${formatPence(topWaste.pence)} of it wasted last week` });
  const short = report.oftenShort[0];
  if (short) out.push({ text: `Keep ${short.name.toLowerCase()} above par all week`, from: `short at ${short.times} counts last week` });
  const below = report.gp.find((g) => g.belowTarget);
  if (below) out.push({ text: `Get ${below.dishName.toLowerCase()} back to ${below.target}% GP`, from: `${below.gp}% last week` });
  if (report.stock.length === 0) out.push({ text: 'Count my section twice this week', from: 'no counts last week' });
  return out;
}

/**
 * Counts, pars and draft orders (SPEC → Section admin; A2, A3, SH3;
 * DECISIONS 53). The chef's working figures for their section, not the
 * kitchen's official records.
 *
 * - A count is one row per section per day: each item's amount, in its par's
 *   unit. Counting again the same day updates it.
 * - Below par: from each section's latest count.
 * - Draft orders: below-par ingredients as whole packs of this kitchen's
 *   product, grouped by supplier with cut-offs. Drafts only: the app never
 *   places an order.
 * - Below-par components go on the next shift's sheet as "top up to par".
 */

import { packsToOrder, shortOfPar, stockValue, suggestPar } from '../core/stock/stock';
import { toCalendarDate } from '../core/time/calendar';
import { itemCost } from './costing';
import { db as appDb, type MepDatabase } from './db';
import { listSectionItems, type SectionItemView } from './sectionItems';
import type { CalendarDate, Id, KitchenId, Quantity, StockCount, Supplier } from './types';

/** The unit an item is counted in: its par's, else "each". */
export const countUnit = (view: SectionItemView) => view.item.par?.unit ?? 'each';

/** The latest count for a section (today's if there is one). */
export async function latestCount(sectionId: Id, database: MepDatabase = appDb): Promise<StockCount | undefined> {
  const counts = await database.stockCounts.where('sectionId').equals(sectionId).toArray();
  return counts.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
}

/** Records one item's count for today (A2): one tap per number, saved as it goes. */
export async function setCount(sectionId: Id, sectionItemId: Id, quantity: Quantity | null, date: CalendarDate = toCalendarDate(new Date()), database: MepDatabase = appDb) {
  await database.transaction('rw', database.stockCounts, async () => {
    const today = (await database.stockCounts.where('sectionId').equals(sectionId).toArray()).find((c) => c.date === date);
    const counts = (today?.counts ?? []).filter((c) => c.sectionItemId !== sectionItemId);
    if (quantity) counts.push({ sectionItemId, quantity });
    if (today) await database.stockCounts.update(today.id, { counts });
    else await database.stockCounts.add({ sectionId, date, counts });
  });
}

export interface CountRow {
  view: SectionItemView;
  count: Quantity | null;
  /** Short of par, in the par's unit; 0 when at or over; null with no par or count. */
  short: number | null;
  /** What the counted amount is worth (pence), if it can be costed. */
  value: number | null;
  /** A new par to consider, with why (never set by itself). */
  suggestion: { par: number; reason: string } | null;
}

export interface CountView {
  date: CalendarDate | null;
  rows: CountRow[];
  /** Stock value of what's counted, and what couldn't be costed. */
  value: { pence: number; uncosted: string[] };
}

/** A section's list in shelf order with its latest count, what's short and what it's worth (A2). */
export async function getCountView(sectionId: Id, kitchenId: KitchenId, now = new Date(), database: MepDatabase = appDb): Promise<CountView> {
  const [items, latest, history, waste] = await Promise.all([
    listSectionItems(sectionId, database),
    latestCount(sectionId, database),
    database.stockCounts.where('sectionId').equals(sectionId).toArray(),
    database.wasteEntries.where('kitchenId').equals(kitchenId).toArray(),
  ]);
  const overPrep = (await database.listValues.where('list').equals('waste-reasons').toArray()).find((v) => v.value.toLowerCase() === 'over-prep')?.id;
  const fortnightAgo = toCalendarDate(new Date(now.getTime() - 14 * 86_400_000));
  const recentCounts = history.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const rows: CountRow[] = [];
  for (const view of items) {
    const count = latest?.counts.find((c) => c.sectionItemId === view.item.id)?.quantity ?? null;
    const short = shortOfPar({ par: view.item.par, count });
    const value = count ? await itemCost({ componentId: view.item.componentId, ingredientId: view.item.ingredientId }, count, kitchenId, database) : null;
    const shortTimes = recentCounts.filter((c) => {
      const q = c.counts.find((x) => x.sectionItemId === view.item.id)?.quantity ?? null;
      return (shortOfPar({ par: view.item.par, count: q }) ?? 0) > 0;
    }).length;
    const overPrepTimes = waste.filter(
      (w) => w.date >= fortnightAgo && w.reasonId === overPrep && ((view.item.componentId && w.componentId === view.item.componentId) || (view.item.ingredientId && w.ingredientId === view.item.ingredientId)),
    ).length;
    rows.push({ view, count, short, value, suggestion: view.item.par ? suggestPar(view.item.par.amount, shortTimes, overPrepTimes) : null });
  }
  const value = stockValue(rows.map((r) => ({ name: r.view.name, count: r.count ? 1 : null, unitCost: r.value })));
  return { date: latest?.date ?? null, rows, value };
}

// ─── Orders (A3) ──────────────────────────────────────────────────────────

export interface OrderLineView {
  ingredientName: string;
  short: Quantity;
  /** Whole packs to order, or null when it can't be worked out (no pack size). */
  packs: number | null;
  pack: Quantity | null;
  brand: string | null;
  /** Pence, if priced. */
  cost: number | null;
}

export interface DraftOrder {
  supplier: Supplier | null;
  lines: OrderLineView[];
  total: number;
}

/** Below-par ingredients across a kitchen's sections, as draft orders by supplier. Never sent by the app. */
export async function draftOrders(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<DraftOrder[]> {
  const sections = await database.sections.where('kitchenId').equals(kitchenId).toArray();
  const suppliers = await database.suppliers.where('kitchenId').equals(kitchenId).toArray();
  const needs = new Map<Id, { name: string; short: Quantity }>();
  for (const section of sections) {
    const latest = await latestCount(section.id, database);
    if (!latest) continue;
    for (const view of await listSectionItems(section.id, database)) {
      if (!view.item.ingredientId || !view.item.par) continue;
      const count = latest.counts.find((c) => c.sectionItemId === view.item.id)?.quantity ?? null;
      const short = shortOfPar({ par: view.item.par, count });
      if (!short) continue;
      const already = needs.get(view.item.ingredientId);
      needs.set(view.item.ingredientId, { name: view.name, short: { amount: (already?.short.amount ?? 0) + short, unit: view.item.par.unit } });
    }
  }
  const bySupplier = new Map<string, DraftOrder>();
  for (const [ingredientId, need] of needs) {
    const products = (await database.products.where('ingredientId').equals(ingredientId).toArray()).filter((p) => p.kitchenId === kitchenId);
    const product = products.find((p) => p.pack) ?? products[0] ?? null;
    const packs = packsToOrder(need.short, product?.pack ?? null);
    const supplier = suppliers.find((s) => s.id === product?.supplierId) ?? null;
    const key = supplier?.id ?? 'none';
    const order = bySupplier.get(key) ?? { supplier, lines: [], total: 0 };
    const cost = packs !== null && product?.price ? packs * product.price : null;
    order.lines.push({ ingredientName: need.name, short: need.short, packs, pack: product?.pack ?? null, brand: product?.brand ?? null, cost });
    order.total += cost ?? 0;
    bySupplier.set(key, order);
  }
  return [...bySupplier.values()].sort((a, b) => (a.supplier?.name ?? '~').localeCompare(b.supplier?.name ?? '~'));
}

/** A draft order as text to send (WhatsApp, email): the chef sends it, never the app. */
export function orderText(order: DraftOrder, kitchenName: string): string {
  const lines = order.lines.map((l) =>
    l.packs !== null && l.pack ? `${l.packs} × ${l.brand ?? l.ingredientName} (${l.pack.amount}${l.pack.unit})` : `${l.ingredientName}: ${l.short.amount}${l.short.unit}`,
  );
  return [`Order for ${kitchenName}${order.supplier ? ` from ${order.supplier.name}` : ''}`, ...lines].join('\n');
}

// ─── Below par → the next shift's sheet (SH3) ─────────────────────────────

/** Components short of par at the latest counts, to top up on the next shift's sheet. */
export async function belowParComponents(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<{ sectionItemId: Id; par: Quantity }[]> {
  const out: { sectionItemId: Id; par: Quantity }[] = [];
  for (const section of await database.sections.where('kitchenId').equals(kitchenId).toArray()) {
    const latest = await latestCount(section.id, database);
    if (!latest) continue;
    for (const view of await listSectionItems(section.id, database)) {
      if (!view.item.componentId || !view.item.par) continue;
      const count = latest.counts.find((c) => c.sectionItemId === view.item.id)?.quantity ?? null;
      if ((shortOfPar({ par: view.item.par, count }) ?? 0) > 0) out.push({ sectionItemId: view.item.id, par: view.item.par });
    }
  }
  return out;
}

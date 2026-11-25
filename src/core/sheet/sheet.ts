/**
 * The shift sheet's rules (SPEC → The shift sheet, SH1–SH3), pure: what
 * order items show in, how far through you are, when the next shift is, and
 * the sheet as text to share.
 */

import { isoDayOfWeek } from '../time/calendar';

/** Unticked items first in their order; ticked ones settle to the bottom (SH1). */
export function sortSheetItems<T extends { done: boolean; order: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);
}

export function sheetProgress(items: readonly { done: boolean }[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/**
 * The date of the next shift after `today`: the next day one of the chef's
 * usual shifts falls on (ISO days, Monday = 1), or tomorrow if none are set.
 */
export function nextShiftDate(today: Date, shiftDays: readonly number[]): Date {
  for (let ahead = 1; ahead <= 7; ahead++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
    if (shiftDays.includes(isoDayOfWeek(date))) return date;
  }
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
}

export interface SheetTextItem {
  /** "Beurre blanc 2l", "Chive oil: top up to 500ml" */
  label: string;
  done: boolean;
  /** Service name, or null for "any time". */
  service: string | null;
}

/**
 * The sheet as plain text for WhatsApp or a message (SH3): a heading, then
 * items grouped by service, ticked ones marked done.
 *
 *   Fish · Wed 26 Nov · Dumbleton Hall
 *   ☐ Beurre blanc 2l
 *   Lunch
 *   ☐ Trout portions 12
 */
export function formatSheetText(heading: string, items: readonly SheetTextItem[]): string {
  const groups = new Map<string | null, SheetTextItem[]>();
  for (const item of items) groups.set(item.service, [...(groups.get(item.service) ?? []), item]);
  const order = [...groups.keys()].sort((a, b) => (a === null ? -1 : b === null ? 1 : 0));
  const lines = [heading];
  for (const service of order) {
    if (service !== null) lines.push('', service);
    for (const item of groups.get(service)!) lines.push(`${item.done ? '☑' : '☐'} ${item.label}`);
  }
  return lines.join('\n');
}

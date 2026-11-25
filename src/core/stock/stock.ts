/**
 * Pars, counts and orders (SPEC → Section admin; A2, A3; DECISIONS 53). Pure.
 *
 * - Below par: what's short of the par, in the par's unit.
 * - An order is whole packs: enough to cover what's short.
 * - Stock value: each item's count × what one unit costs.
 * - A par suggestion is only a suggestion, with its reason.
 */

import { convertAmount } from '../scaling/scaling';

export interface Counted {
  par: { amount: number; unit: string } | null;
  count: { amount: number; unit: string } | null;
}

/** How much is short of par, in the par's unit (0 when at or over; null when there's no par or count). */
export function shortOfPar({ par, count }: Counted): number | null {
  if (!par || !count) return null;
  const have = convertAmount(count.amount, count.unit, par.unit);
  if (have === null) return null;
  return Math.max(0, Math.round((par.amount - have) * 1000) / 1000);
}

/** Whole packs to cover a shortfall: 3.2 kg short in 2.5 kg packs → 2 packs. null when units can't be compared. */
export function packsToOrder(short: { amount: number; unit: string }, pack: { amount: number; unit: string } | null): number | null {
  if (short.amount <= 0) return 0;
  if (!pack || pack.amount <= 0) return null;
  const inPacks = convertAmount(short.amount, short.unit, pack.unit);
  return inPacks === null ? null : Math.ceil(inPacks / pack.amount - 1e-9);
}

/** The value of what's been counted: Σ count × cost per unit (pence); items with no cost are left out and listed. */
export function stockValue(items: readonly { name: string; count: number | null; unitCost: number | null }[]): { pence: number; uncosted: string[] } {
  let pence = 0;
  const uncosted: string[] = [];
  for (const item of items) {
    if (item.count === null || item.count === 0) continue;
    if (item.unitCost === null) uncosted.push(item.name);
    else pence += item.count * item.unitCost;
  }
  return { pence: Math.round(pence), uncosted };
}

/**
 * A suggested par from recent counts and waste (SPEC: "the app may suggest
 * a new par"):
 * - short at three or more of the last counts → raise it by a quarter;
 * - wasted as over-prep twice or more lately → lower it by a fifth.
 * Never set by itself: the chef takes it or not.
 */
export function suggestPar(par: number, recentShortCounts: number, recentOverPrepWaste: number): { par: number; reason: string } | null {
  if (recentShortCounts >= 3) return { par: Math.round(par * 1.25 * 10) / 10, reason: `Short at ${recentShortCounts} of your recent counts.` };
  if (recentOverPrepWaste >= 2) return { par: Math.round(par * 0.8 * 10) / 10, reason: `Wasted as over-prep ${recentOverPrepWaste} times lately.` };
  return null;
}

/**
 * Costing (SPEC → Section admin; A1; DECISIONS 53). Pure. Money is whole pence.
 *
 * - A line costs its share of a pack: amount ÷ pack size × pack price,
 *   converting units (with the ingredient's density or the chef's weights),
 *   then grossed up for yield loss (peel, trim): 1 kg of carrots with 20%
 *   loss costs 1 kg ÷ 0.8 worth.
 * - A component costs the sum of its lines; per unit of what it makes, that
 *   ÷ its yield. Components used in it cost what they make it cost.
 * - GP is worked from the price without VAT (menu prices include 20%):
 *   GP% = (price ÷ 1.2 − cost) ÷ (price ÷ 1.2).
 */

import { convertAmount, type Weights } from '../scaling/scaling';

export const VAT_RATE = 0.2;

export interface PackPrice {
  /** The pack: 5 kg, 2.5 l, 12 each. */
  amount: number;
  unit: string;
  /** What the pack costs, in pence. */
  price: number;
}

/**
 * What an amount of an ingredient costs, in pence, from its pack price.
 * null when it can't be worked out (no price, or units that can't be compared).
 */
export function lineCost(amount: number, unit: string, pack: PackPrice | null, weights: Weights = {}, yieldLossPercent: number | null = null): number | null {
  if (!pack || pack.amount <= 0) return null;
  const inPackUnits = convertAmount(amount, unit, pack.unit, weights);
  if (inPackUnits === null) return null;
  const loss = yieldLossPercent && yieldLossPercent > 0 && yieldLossPercent < 100 ? yieldLossPercent / 100 : 0;
  return (inPackUnits / pack.amount) * pack.price / (1 - loss);
}

/** What one unit of a component costs, from its batch cost and what a batch makes. */
export function costPerUnit(batchCost: number, yieldAmount: number): number | null {
  return yieldAmount > 0 ? batchCost / yieldAmount : null;
}

/** The menu price without VAT. */
export function netPrice(priceIncVat: number, vatRate = VAT_RATE): number {
  return priceIncVat / (1 + vatRate);
}

/** GP% of a dish: from the price without VAT. null with no price. */
export function grossProfitPercent(priceIncVat: number | null, cost: number, vatRate = VAT_RATE): number | null {
  if (!priceIncVat || priceIncVat <= 0) return null;
  const net = netPrice(priceIncVat, vatRate);
  return Math.round(((net - cost) / net) * 1000) / 10;
}

/** "£4.27" from pence, to the penny. */
export function formatPence(pence: number): string {
  return `£${(Math.round(pence) / 100).toFixed(2)}`;
}

/**
 * Scaling a component or a dish (SPEC → Scaling; S1–S3; DECISIONS 42–43).
 * The maths is pure, in src/core/scaling; this file brings the recipe and
 * the ingredients' weights to it, and remembers the last scaling choice per
 * component (UX rule 2). Nothing here changes a stored recipe.
 */

import { formatAmount, roundForKitchen } from '../core/scaling/rounding';
import { amountForPortions, anchorFactor, scaleAmount, yieldFactor, type Weights } from '../core/scaling/scaling';
import { isUnit } from '../core/units/units';
import { db as appDb, type MepDatabase } from './db';
import { getComponentDetails, getDishDetails, getVariationInUse } from './library';
import { getSetting, setSetting } from './settings';
import type { Component, DishComponent, Id, KitchenId, Quantity } from './types';

/** How the chef chose to scale a component. */
export type ScaleChoice =
  /** "Make 3 l" (or "40 portions"). */
  | { by: 'yield'; amount: number; unit: string }
  /** "I've got 340 g of butter": the line, and how much there is. */
  | { by: 'anchor'; lineId: Id; amount: number; unit: string; /** Finds the line again in a later version. */ ingredientId?: Id | null };

const choiceKey = (componentId: Id) => `scale.${componentId}`;

/** The last scaling choice for this component, or null for "as written". */
export async function getScaleChoice(componentId: Id, database: MepDatabase = appDb): Promise<ScaleChoice | null> {
  return (await getSetting<ScaleChoice | null>(choiceKey(componentId), database)) ?? null;
}

export async function setScaleChoice(componentId: Id, choice: ScaleChoice | null, database: MepDatabase = appDb) {
  await setSetting(choiceKey(componentId), choice, database);
}

// ─── A component, scaled ──────────────────────────────────────────────────

export interface ScaledLine {
  lineId: Id;
  name: string;
  prepNote: string;
  /** As written: "250g". "" when the line has no amount. */
  written: string;
  /** Scaled and rounded: "340g". null when the line has no amount to scale. */
  scaled: string | null;
  /** "≈ 1¼ tsp": a rough measure made measurable (DECISIONS 41). */
  estimate: string | null;
  /** A component used in this one: open it scaled to the amount needed. */
  component: { id: Id; amount: number; unit: string } | null;
  /** Can be the anchor: it has an amount. */
  canAnchor: boolean;
  /** For the anchor sheet: the line's own unit. */
  unit: string | null;
  ingredientId: Id | null;
}

export interface ScaledComponent {
  /** 1 = as written. */
  factor: number;
  /** What it makes at this scale: "3l". null if the base yield isn't set. */
  makes: string | null;
  /** What it makes as written. */
  baseYield: Quantity | null;
  lines: ScaledLine[];
  /** Why the choice couldn't be applied ("Mep can't compare ml with g for cream…"); the recipe shows as written. */
  problem: string | null;
}

/** Weights for each of these ingredients: density and the chef's own. */
async function weightsFor(ingredientIds: Id[], database: MepDatabase): Promise<Map<Id, Weights>> {
  const rows = await database.ingredients.bulkGet(ingredientIds);
  return new Map(rows.filter((r) => r !== undefined).map((r) => [r.id, { density: r.density, unitWeights: r.unitWeights }]));
}

/** A component's lines at the chosen scale (or as written when `choice` is null). */
export async function getScaledComponent(
  componentId: Id,
  kitchenId: KitchenId,
  choice: ScaleChoice | null,
  database: MepDatabase = appDb,
): Promise<ScaledComponent | undefined> {
  const details = await getComponentDetails(componentId, kitchenId, database);
  if (!details) return undefined;
  const baseYield = details.variation?.baseYield ?? null;
  const weights = await weightsFor(details.lines.map((l) => l.line.ingredientId).filter((id) => id !== null), database);

  let factor = 1;
  let problem: string | null = null;
  if (choice?.by === 'yield') {
    if (!baseYield) problem = 'Set what this recipe makes first (Makes, above), then scale by yield.';
    else {
      const f = yieldFactor(baseYield, choice);
      if (f === null) problem = `This recipe makes ${formatAmount(baseYield.amount, baseYield.unit)}; Mep can’t turn that into ${choice.unit}.`;
      else factor = f;
    }
  } else if (choice?.by === 'anchor') {
    const anchor =
      details.lines.find((l) => l.line.id === choice.lineId) ??
      (choice.ingredientId ? details.lines.find((l) => l.line.ingredientId === choice.ingredientId) : undefined);
    if (!anchor || anchor.line.quantity === null) problem = 'That ingredient is no longer in the recipe, or has no amount.';
    else {
      const lineUnit = anchor.line.unit ?? 'each';
      const w = anchor.line.ingredientId ? weights.get(anchor.line.ingredientId) : undefined;
      const f = anchorFactor({ amount: anchor.line.quantity, unit: lineUnit }, choice, w);
      if (f === null) problem = `Mep can’t turn ${choice.unit} into ${lineUnit} for ${anchor.name.toLowerCase()}. On its ingredient page, add what it weighs.`;
      else factor = f;
    }
  }

  const lines = details.lines.map(({ line, name, target }): ScaledLine => {
    const unit = line.quantity !== null ? (line.unit ?? 'each') : null;
    const written = line.quantity !== null ? formatAmount(line.quantity, unit!) : '';
    const scaled = line.quantity !== null ? scaleAmount(line.quantity, unit!, factor, line.ingredientId ? weights.get(line.ingredientId) : undefined) : null;
    return {
      lineId: line.id,
      name,
      prepNote: line.prepNote,
      written,
      scaled: scaled ? formatAmount(scaled.amount, scaled.unit) : null,
      estimate: scaled?.estimate ?? null,
      component: target?.kind === 'component' && line.quantity !== null ? { id: target.id, amount: line.quantity * factor, unit: unit! } : null,
      canAnchor: line.quantity !== null && line.quantity > 0,
      unit,
      ingredientId: line.ingredientId,
    };
  });

  let makes: string | null = null;
  if (baseYield && isUnit(baseYield.unit)) {
    const rounded = roundForKitchen(baseYield.amount * factor, baseYield.unit);
    makes = formatAmount(rounded.amount, rounded.unit);
  }
  return { factor, makes, baseYield, lines, problem };
}

// ─── A dish, scaled ───────────────────────────────────────────────────────

export interface DishComponentNeed {
  link: DishComponent;
  component: Component;
  /** For this many portions: "1.2l". null when no amount per portion is set. */
  needed: string | null;
  /** To open the component scaled to what's needed. */
  amount: number | null;
  unit: string | null;
  /** The component's variation in use is a draft. */
  isDraft: boolean;
}

/** What each component of a dish comes to for `portions` covers or people (S1, S3). */
export async function getDishNeeds(dishId: Id, kitchenId: KitchenId, portions: number, database: MepDatabase = appDb): Promise<DishComponentNeed[]> {
  const details = await getDishDetails(dishId, database);
  if (!details) return [];
  return Promise.all(
    details.components.map(async ({ link, component }) => {
      const variation = await getVariationInUse(component.id, kitchenId, database);
      const per = link.quantityPerPortion;
      if (!per || !isUnit(per.unit)) return { link, component, needed: null, amount: null, unit: null, isDraft: variation?.status !== 'ready' };
      const total = amountForPortions(per, portions);
      const rounded = roundForKitchen(total.amount, per.unit);
      return {
        link,
        component,
        needed: formatAmount(rounded.amount, rounded.unit),
        amount: total.amount,
        unit: total.unit,
        isDraft: variation?.status !== 'ready',
      };
    }),
  );
}

/** How much of a component goes on one portion of the dish: "30ml" of sauce. */
export async function setQuantityPerPortion(linkId: Id, quantityPerPortion: Quantity | null, database: MepDatabase = appDb) {
  await database.dishComponents.update(linkId, { quantityPerPortion });
}

const dishPortionsKey = (dishId: Id) => `portions.${dishId}`;

/** The last number of portions the chef scaled this dish to. */
export async function getDishPortions(dishId: Id, database: MepDatabase = appDb): Promise<number | null> {
  return (await getSetting<number | null>(dishPortionsKey(dishId), database)) ?? null;
}

export async function setDishPortions(dishId: Id, portions: number | null, database: MepDatabase = appDb) {
  await setSetting(dishPortionsKey(dishId), portions, database);
}

// ─── An ingredient's weights ──────────────────────────────────────────────

/**
 * The count and rough units this ingredient is written with ("handful",
 * "each", "knob"): the ones worth giving a weight. Weight and volume units
 * are left out: they convert by themselves or by density.
 */
export async function ingredientCountUnits(ingredientId: Id, database: MepDatabase = appDb): Promise<string[]> {
  const lines = await database.lines.where('ingredientId').equals(ingredientId).toArray();
  const units = new Set<string>();
  for (const line of lines) {
    const unit = line.quantity !== null ? (line.unit ?? 'each') : null;
    if (unit && isUnit(unit) && !['g', 'kg', 'ml', 'l', 'pint'].includes(unit)) units.add(unit);
  }
  return [...units].sort();
}

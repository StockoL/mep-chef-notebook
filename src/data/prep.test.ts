import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import type { MepDatabase } from './db';
import { addShift, createKitchen, listServices, setPlace, updateService, updateShift } from './kitchens';
import { createComponent, getVariationInUse, saveLines, saveSteps, setBaseYield } from './library';
import { getPlanView } from './plan';
import { finishPart, getPrepView, startPart, undoFinish } from './prep';
import { addSheetItems, getOrCreateSheet } from './sheets';
import { confirmAllSteps } from './steps';
import { freshDatabase } from './testing';

let db: MepDatabase;
let kitchenId: string;
const at = (h: number, m = 0, day = 25) => new Date(2026, 10, day, h, m);
const everyDay = [1, 2, 3, 4, 5, 6, 7] as const;

beforeEach(async () => {
  db = await freshDatabase();
  kitchenId = await createKitchen('Dumbleton Hall', db);
  await setPlace(kitchenId, db);
  const lunch = (await listServices(kitchenId, db)).find((s) => s.name === 'Lunch')!;
  await updateService(lunch.id, { windows: [{ days: [...everyDay], firstTickets: '12:00', lastBookings: '14:30', usualFinish: null }] }, db);
  const shift = await addShift(kitchenId, db);
  await updateShift(shift, { start: '10:00', end: '22:30', days: [...everyDay] }, db);
});
afterEach(async () => {
  await db.delete();
});

async function shallotsOnSheet(day = '2026-11-25', amount: { amount: number; unit: string } | null = null) {
  const id = await createComponent('Brunoise shallots', kitchenId, db);
  const variation = (await getVariationInUse(id, kitchenId, db))!;
  await saveLines(variation.id, parseShorthand('shallots 500g'), db);
  await setBaseYield(variation.id, { amount: 500, unit: 'g' }, db);
  await saveSteps(variation.id, ['Peel shallots 10 min', 'Brunoise shallots 30 min'], db);
  await confirmAllSteps(variation.id, db);
  const sheetId = await getOrCreateSheet(kitchenId, day, [], db);
  const [itemId] = await addSheetItems(sheetId, [{ componentId: id, quantity: amount, source: 'manual' }], db);
  return itemId!;
}

describe('prep mode (SM1–SM3)', () => {
  it('starts, finishes, ticks the sheet when the job is done, and picks up after a restart', async () => {
    const itemId = await shallotsOnSheet();
    let view = await getPrepView(kitchenId, at(10), db);
    expect(view.state.queue.map((p) => p.label)).toEqual(['Peel shallots 10 min', 'Brunoise shallots 30 min']);

    const peel = await startPart(kitchenId, view.state.queue[0]!, view, at(10), db);
    view = await getPrepView(kitchenId, at(10, 5), db);
    expect(view.state.running.map((r) => r.part.label)).toEqual(['Peel shallots 10 min']);

    await finishPart(peel, view, {}, at(10, 12), db);
    view = await getPrepView(kitchenId, at(10, 12), db);
    const brunoise = await startPart(kitchenId, view.state.queue[0]!, view, at(10, 12), db);
    view = await getPrepView(kitchenId, at(10, 40), db);
    const finished = await finishPart(brunoise, view, {}, at(10, 40), db);
    expect(finished.tickedItemId).toBe(itemId);
    expect((await db.sheetItems.get(itemId))!.done).toBe(true);

    const timings = await db.timings.toArray();
    expect(timings.map((t) => t.minutes).sort()).toEqual([12, 28]);

    await undoFinish(finished, db);
    expect((await db.sheetItems.get(itemId))!.done).toBe(false);
    expect(await db.timings.count()).toBe(1);
  });

  it('learns: after three timings the plan uses your time, scaled by batch', async () => {
    await shallotsOnSheet('2026-11-25', { amount: 1, unit: 'kg' });
    const plan = await getPlanView(kitchenId, at(10), db);
    const brunoise = plan.planJobs[0]!.parts[1]!;
    expect(brunoise.minutes).toBe(30);
    // Three past brunoises at a double batch, 40 minutes each.
    for (const minutes of [40, 41, 39]) {
      await db.timings.add({ stepKey: brunoise.stepKey!, equipmentId: null, kitchenId, quantity: 2, minutes, interrupted: false, inServiceWindow: false });
    }
    const after = await getPlanView(kitchenId, at(10), db);
    expect(after.planJobs[0]!.parts[1]).toMatchObject({ minutes: 40, learnedFrom: 3 });
  });

  it('your hands-on times go with you to another kitchen', async () => {
    await shallotsOnSheet();
    const brunoise = (await getPlanView(kitchenId, at(10), db)).planJobs[0]!.parts[1]!;
    const other = await createKitchen('Ellenborough Park', db);
    for (const minutes of [20, 21, 22]) {
      await db.timings.add({ stepKey: brunoise.stepKey!, equipmentId: null, kitchenId: other, quantity: null, minutes, interrupted: false, inServiceWindow: false });
    }
    expect((await getPlanView(kitchenId, at(10), db)).planJobs[0]!.parts[1]!.minutes).toBe(21);
  });

  it('an interrupted step isn’t learned from', async () => {
    await shallotsOnSheet();
    let view = await getPrepView(kitchenId, at(10), db);
    const peel = await startPart(kitchenId, view.state.queue[0]!, view, at(10), db);
    view = await getPrepView(kitchenId, at(10, 30), db);
    await finishPart(peel, view, { interrupted: true }, at(10, 30), db);
    expect((await db.timings.toArray())[0]).toMatchObject({ interrupted: true, minutes: 30 });
  });
});

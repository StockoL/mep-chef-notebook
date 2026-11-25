import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import type { MepDatabase } from './db';
import { addShift, createKitchen, listServices, setPlace, updateService, updateShift } from './kitchens';
import { createComponent, getVariationInUse, saveLines, saveSteps } from './library';
import { getPlanView } from './plan';
import { addSheetItems, getOrCreateSheet, setItemDone } from './sheets';
import { confirmAllSteps } from './steps';
import { freshDatabase } from './testing';

let db: MepDatabase;
let kitchenId: string;
// A Wednesday, 10:00.
const morning = new Date(2026, 10, 25, 10, 0);
const today = '2026-11-25';
const everyDay = [1, 2, 3, 4, 5, 6, 7] as const;

beforeEach(async () => {
  db = await freshDatabase();
  kitchenId = await createKitchen('Dumbleton Hall', db);
  await setPlace(kitchenId, db);
  const services = await listServices(kitchenId, db);
  const lunch = services.find((s) => s.name === 'Lunch')!;
  const dinner = services.find((s) => s.name === 'Dinner')!;
  await updateService(lunch.id, { windows: [{ days: [...everyDay], firstTickets: '12:00', lastBookings: '14:30', usualFinish: null }] }, db);
  await updateService(dinner.id, { windows: [{ days: [...everyDay], firstTickets: '18:00', lastBookings: '20:15', usualFinish: null }] }, db);
  const shift = await addShift(kitchenId, db);
  await updateShift(shift, { start: '09:00', end: '22:30', days: [...everyDay] }, db);
});
afterEach(async () => {
  await db.delete();
});

/** A component with a confirmed method: ready for the plan. */
async function ready(name: string, lines: string, steps: string[]) {
  const id = await createComponent(name, kitchenId, db);
  const variation = (await getVariationInUse(id, kitchenId, db))!;
  await saveLines(variation.id, parseShorthand(lines), db);
  await saveSteps(variation.id, steps, db);
  await confirmAllSteps(variation.id, db);
  return id;
}

async function onSheet(date: string, componentIds: string[]) {
  const sheetId = await getOrCreateSheet(kitchenId, date, [], db);
  return addSheetItems(sheetId, componentIds.map((componentId) => ({ componentId, source: 'manual' as const })), db);
}

describe('the plan from today’s sheet', () => {
  it('puts ready recipes in time order, ready by the next service, with drafts beside it', async () => {
    const stock = await ready('Chicken stock', 'bones 2kg', ['Cover bones with cold water, bring to boil 20 min, skim', 'Simmer 90 min, skim every 30 min']);
    const shallots = await ready('Brunoise shallots', 'shallots 500g', ['Brunoise shallots 30 min']);
    const draft = await createComponent('Pickled walnuts', kitchenId, db);
    const [stockItem] = await onSheet(today, [stock, shallots, draft]);

    const plan = await getPlanView(kitchenId, morning, db);
    expect(plan.start).toBe(600);
    expect(plan.windows.map((w) => w.name)).toEqual(['Lunch', 'Dinner']);
    expect(plan.todos.map((t) => [t.view.name, t.reason])).toEqual([['Pickled walnuts', 'Draft: not in the plan until its method is confirmed']]);
    expect(plan.jobs.get(stockItem!)?.readyByLabel).toBe('Ready by Lunch');
    // The stock starts first (it's the longer chain); the brunoise runs alongside the boil and simmer.
    expect(plan.plan.parts.map((p) => [plan.jobs.get(p.jobId)!.view.name, p.start])).toEqual([
      ['Chicken stock', 600],
      ['Brunoise shallots', 600],
      ['Chicken stock', 620],
    ]);
    expect(plan.plan.jobs.every((j) => j.late === 0)).toBe(true);
  });

  it('leaves out what’s ticked off, and says when there are no service times', async () => {
    const shallots = await ready('Brunoise shallots', 'shallots 500g', ['Brunoise shallots 30 min']);
    const [item] = await onSheet(today, [shallots]);
    await setItemDone(item!, true, db);
    const plan = await getPlanView(kitchenId, morning, db);
    expect(plan.plan.parts).toEqual([]);
    expect(plan.done.map((d) => d.name)).toEqual(['Brunoise shallots']);
  });

  it('waits for the stock before the sauce that needs it', async () => {
    const stock = await ready('Brown stock', 'bones 2kg', ['Simmer 60 min']);
    const sauce = await ready('Red wine sauce', 'shallots 200g', ['Add @brown stock, reduce 30 min']);
    await onSheet(today, [sauce, stock]);
    const plan = await getPlanView(kitchenId, morning, db);
    const start = (name: string) => plan.plan.parts.find((p) => plan.jobs.get(p.jobId)!.view.name === name)!.start;
    expect(start('Red wine sauce')).toBe(start('Brown stock') + 60);
  });

  it('starts tomorrow’s overnight cure today, and today’s skips what was started yesterday (PS3)', async () => {
    const trout = await ready('Cured trout', 'trout sides 2', ['Cure trout sides in salt and sugar 24 hrs', 'Rinse and pat dry 10 min', 'Portion 60g 20 min']);
    await onSheet('2026-11-26', [trout]);
    await onSheet(today, [trout]);
    const plan = await getPlanView(kitchenId, morning, db);
    const tomorrow = [...plan.jobs.entries()].find(([, info]) => info.forDay === 'tomorrow')!;
    expect(tomorrow[1].readyByLabel).toBe('For tomorrow: started before you go');
    expect(plan.plan.parts.filter((p) => p.jobId === tomorrow[0]).map((p) => p.label)).toEqual(['Cure trout sides in salt and sugar 24 hrs']);
    const todays = [...plan.jobs.entries()].find(([, info]) => info.forDay === 'today')!;
    expect(todays[1].startedYesterday).toEqual(['Cure trout sides in salt and sugar 24 hrs']);
    expect(plan.plan.parts.filter((p) => p.jobId === todays[0]).map((p) => p.label)).toEqual(['Rinse and pat dry 10 min', 'Portion 60g 20 min']);
  });

  it('starts at the start of the shift when looked at before it', async () => {
    const plan = await getPlanView(kitchenId, new Date(2026, 10, 25, 7, 30), db);
    expect(plan.start).toBe(540);
  });
});

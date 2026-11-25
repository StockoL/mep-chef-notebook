import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import { MepDatabase, SCHEMA_V1 } from './db';
import { newId } from './ids';
import { createKitchen, setPlace } from './kitchens';
import { createComponent, getComponentDetails, getVariationInUse, saveLines, saveSteps } from './library';
import { mergeListItem } from './lists';
import { confirmAllSteps, confirmStep, getMissing, learnWord, listEquipment, readUnreadSteps, unlearnWord, updateStepPart } from './steps';
import { freshDatabase } from './testing';

let db: MepDatabase;
let kitchenId: string;
beforeEach(async () => {
  db = await freshDatabase();
  kitchenId = await createKitchen('Dumbleton Hall', db);
  await setPlace(kitchenId, null, db);
});
afterEach(async () => {
  await db.delete();
});

async function recipe(name: string, lines: string, steps: string[]) {
  const id = await createComponent(name, kitchenId, db);
  const variation = (await getVariationInUse(id, kitchenId, db))!;
  await saveLines(variation.id, parseShorthand(lines), db);
  const change = await saveSteps(variation.id, steps, db);
  const details = (await getComponentDetails(id, kitchenId, db))!;
  return { id, variationId: variation.id, steps: details.steps, change };
}

const equipmentNamed = async (name: string) => (await listEquipment(kitchenId, db)).find((v) => v.value === name)!.id;

describe('reading steps as they are saved', () => {
  it('reads each line into parts, matched to the kitchen’s equipment, lines and components', async () => {
    const stock = await createComponent('Brown stock', kitchenId, db);
    const { steps } = await recipe('Red wine sauce', 'shallots 200g, red wine 750ml', ['Sweat shallots in butter 10 min', 'Add 2L @brown stock, reduce by 2/3, 45 min-1h', 'Cook down 20 min, blend, pass']);

    expect(steps[0]!.parts[0]).toMatchObject({ mode: 'check-in', minutesMin: 10, equipmentTypeId: await equipmentNamed('Hob') });
    expect(steps[0]!.parts[0]!.scalesWithLineId).not.toBeNull();
    expect(steps[1]!.parts[0]).toMatchObject({ dependsOnComponentIds: [stock], minutesMin: 45, minutesMax: 60 });
    expect(steps[2]!.parts.map((p) => p.equipmentTypeId)).toEqual([await equipmentNamed('Hob'), await equipmentNamed('Blender'), await equipmentNamed('Bench')]);
  });

  it('keeps readings and confirmation for lines that didn’t change, and reads changed ones again', async () => {
    const { variationId, steps } = await recipe('Stock', 'bones 2kg', ['Roast bones 220c 45 min', 'Simmer 6 hrs']);
    await confirmStep(steps[0]!.id, true, db);
    await updateStepPart(steps[0]!.id, 0, { minutesMin: 50, minutesMax: 50 }, db);
    await saveSteps(variationId, ['Roast bones 220c 45 min', 'Simmer 8 hrs'], db);
    const after = (await db.steps.where('versionId').equals(steps[0]!.versionId).sortBy('order'))!;
    expect(after[0]).toMatchObject({ confirmed: true, parts: [expect.objectContaining({ minutesMin: 50 })] });
    expect(after[1]).toMatchObject({ confirmed: false, parts: [expect.objectContaining({ minutesMin: 480 })] });
  });
});

describe('draft or ready', () => {
  it('is ready once every step is complete and confirmed, and drops back with a reason', async () => {
    const { variationId, change } = await recipe('Stock', 'bones 2kg', ['Roast bones 220c 45 min', 'Pass']);
    expect(change).toMatchObject({ to: 'draft' });
    expect((await getMissing(variationId, db)).map((m) => m.text)).toEqual(['Step 1: not confirmed', 'Step 2: no time', 'Step 2: not confirmed']);

    const pass = (await db.steps.where('versionId').equals((await db.variations.get(variationId))!.currentVersionId!).sortBy('order'))[1]!;
    await updateStepPart(pass.id, 0, { minutesMin: 10, minutesMax: 10 }, db);
    await confirmAllSteps(variationId, db);
    expect((await db.variations.get(variationId))!.status).toBe('ready');

    const dropped = await updateStepPart(pass.id, 0, { minutesMin: null, minutesMax: null }, db);
    expect(dropped).toMatchObject({ from: 'ready', to: 'draft', missing: [expect.objectContaining({ text: 'Step 2: no time' })] });
  });
});

describe('the word list', () => {
  it('applies a correction to the next step read, and can be undone', async () => {
    const oven = await equipmentNamed('Oven');
    const { before, id } = await learnWord('Toast', { mode: 'passive', equipmentTypeId: oven }, db);
    const { steps } = await recipe('Nuts', 'almonds 200g', ['Toast almonds 160c 8 min']);
    expect(steps[0]!.parts[0]).toMatchObject({ mode: 'passive', equipmentTypeId: oven });
    await unlearnWord(id, before, db);
    expect(await db.wordListEntries.count()).toBe(0);
  });

  it('follows equipment merges into step parts', async () => {
    const { steps } = await recipe('Stock', 'bones 2kg', ['Roast bones 45 min']);
    const oven = await equipmentNamed('Oven');
    const combi = await equipmentNamed('Combi');
    await mergeListItem({ kind: 'values', list: 'equipment-types', kitchenId }, oven, combi, db);
    expect((await db.steps.get(steps[0]!.id))!.parts[0]!.equipmentTypeId).toBe(combi);
  });
});

describe('older data', () => {
  it('adds Bench to each kitchen’s equipment once', async () => {
    expect((await listEquipment(kitchenId, db)).filter((v) => v.value === 'Bench')).toHaveLength(1);
  });

  it('reads steps from before the reader when the app starts', async () => {
    const name = `v3-${newId()}`;
    const v3 = new Dexie(name);
    v3.version(1).stores(SCHEMA_V1);
    await v3.open();
    await v3.table('steps').add({ id: 's1', versionId: 'v1', order: 0, text: 'Simmer 6 hrs', mode: null, minutesMin: null, minutesMax: null, equipmentTypeId: null, confirmed: false, createdAt: 't', updatedAt: 't' });
    v3.close();

    const upgraded = new MepDatabase(name);
    await upgraded.open();
    expect(await upgraded.steps.get('s1')).toMatchObject({ parts: [], confirmed: false });
    expect(await upgraded.steps.get('s1')).not.toHaveProperty('mode');
    expect(await readUnreadSteps(upgraded)).toBe(1);
    expect((await upgraded.steps.get('s1'))!.parts[0]).toMatchObject({ mode: 'check-in', minutesMin: 360 });
    await upgraded.delete();
  });
});

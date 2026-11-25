import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import type { MepDatabase } from './db';
import { createKitchen, setPlace } from './kitchens';
import { createComponent, getComponentDetails, getVariationInUse, saveLines, saveSteps } from './library';
import { createTextNote } from './notes';
import { restoreSnapshot } from './snapshot';
import { confirmAllSteps } from './steps';
import {
  addVariant,
  applyTemplate,
  createTechnique,
  deleteTechnique,
  getTechniqueDetails,
  listTechniques,
  listTemplates,
  saveAsTemplate,
  setKitchenNote,
  sortToTechnique,
  techniquesForIngredient,
} from './techniques';
import { freshDatabase } from './testing';

let db: MepDatabase;
let kitchenId: string;
beforeEach(async () => {
  db = await freshDatabase();
  kitchenId = await createKitchen('Dumbleton Hall', db);
  await setPlace(kitchenId, db);
});
afterEach(async () => {
  await db.delete();
});

const named = async (name: string) => (await listTechniques(db)).find((t) => t.name === name)!;

async function recipe(name: string, lines: string, steps: string[] = []) {
  const id = await createComponent(name, kitchenId, db);
  const variation = (await getVariationInUse(id, kitchenId, db))!;
  await saveLines(variation.id, parseShorthand(lines), db);
  if (steps.length) await saveSteps(variation.id, steps, db);
  return { id, variationId: variation.id };
}

describe('built-in techniques', () => {
  it('ships names and aliases, with a category, and no notes of its own', async () => {
    const quenelle = await named('Quenelle');
    expect(quenelle).toMatchObject({ aliases: ['rocher'], notes: '', mediaIds: [] });
    const category = await db.listValues.get(quenelle.categoryId!);
    expect(category?.value).toBe('Shaping and plating');
  });

  it('is added once: what the chef deletes stays deleted', async () => {
    const quenelle = await named('Quenelle');
    await deleteTechnique(quenelle.id, db);
    const { ensureBuiltIns } = await import('./db');
    await ensureBuiltIns(db);
    expect((await listTechniques(db)).some((t) => t.name === 'Quenelle')).toBe(false);
  });
});

describe('method templates (T3)', () => {
  it('a shorthand ingredient list plus a template is ready after one confirm', async () => {
    const { id, variationId } = await recipe('Brown chicken stock', 'chicken bones 5kg, mirepoix, tom puree 2 tbsp, red wine 375ml');
    const templates = await listTemplates('Brown chicken stock', db);
    expect(templates[0]).toMatchObject({ techniqueName: 'Brown stock', suggested: true });

    await applyTemplate(variationId, templates[0]!.template.id, db);
    const { change } = await confirmAllSteps(variationId, db);
    expect(change).toMatchObject({ to: 'ready' });
    const steps = (await getComponentDetails(id, kitchenId, db))!.steps;
    expect(steps).toHaveLength(7);
    // The reader linked the roast to the recipe's bones line, so its time scales with them.
    expect(steps[0]!.parts[0]!.scalesWithLineId).not.toBeNull();
  });

  it('adds a template after steps already written, and saves a method as a new template', async () => {
    const { variationId } = await recipe('Pickled shallots', 'shallots 500g', ['Peel shallots 20 min']);
    const pickle = (await listTemplates('Pickled shallots', db)).find((t) => t.techniqueName === 'Pickle')!;
    await applyTemplate(variationId, pickle.template.id, db);
    const variation = (await db.variations.get(variationId))!;
    expect((await db.steps.where('versionId').equals(variation.currentVersionId!).sortBy('order')).map((s) => s.text)[0]).toBe('Peel shallots 20 min');

    const templateId = await saveAsTemplate(variationId, { name: 'House pickle' }, db);
    expect((await db.methodTemplates.get(templateId))!.steps).toHaveLength(4);
    expect((await named('House pickle')).id).toBeDefined();
  });
});

describe('a technique entry (T1, T2)', () => {
  it('has variants, a note for this kitchen, inbox notes, and where it’s used', async () => {
    const quenelle = await named('Quenelle');
    await addVariant(quenelle.id, 'textured mixes', db);
    await setKitchenNote(quenelle.id, kitchenId, 'Three-sided quenelles here', db);
    const noteId = await createTextNote('Warm the spoon first', db);
    await sortToTechnique(noteId, quenelle.id, db);
    await recipe('Chocolate mousse', 'chocolate 200g', ['Quenelle onto the plate to order']);

    const details = (await getTechniqueDetails(quenelle.id, kitchenId, db))!;
    expect(details.variants.map((v) => v.context)).toEqual(['textured mixes']);
    expect(details.kitchenNote?.notes).toBe('Three-sided quenelles here');
    expect(details.notes.map((n) => n.body)).toEqual(['Warm the spoon first']);
    expect(details.usedIn.map((c) => c.name)).toEqual(['Chocolate mousse']);
    // Another kitchen doesn't see this kitchen's note.
    const other = await createKitchen('Ellenborough Park', db);
    expect((await getTechniqueDetails(quenelle.id, other, db))!.kitchenNote).toBeUndefined();
  });

  it('shows the techniques applied to an ingredient, from prep notes and steps', async () => {
    await recipe('Remoulade', 'celeriac 1kg (julienne), mayonnaise 200g');
    await recipe('Celeriac purée', 'celeriac 1kg, milk 500ml', ['Sweat celeriac in butter 10 min']);
    const celeriac = (await db.ingredients.toArray()).find((i) => i.name === 'Celeriac')!;
    const applied = await techniquesForIngredient(celeriac.id, db);
    expect(applied.map((a) => [a.technique.name, a.components.map((c) => c.name)])).toEqual([
      ['Julienne', ['Remoulade']],
      ['Sweat', ['Celeriac purée']],
    ]);
  });

  it('a new technique word is added once, and deleting comes with undo', async () => {
    const id = await createTechnique('dauphinoise', db);
    expect(await createTechnique('Dauphinoise', db)).toBe(id);
    const snapshot = await deleteTechnique(id, db);
    expect(await db.techniques.get(id)).toBeUndefined();
    await restoreSnapshot(snapshot, db);
    expect((await db.techniques.get(id))?.name).toBe('Dauphinoise');
  });
});

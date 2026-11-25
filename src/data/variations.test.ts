import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseShorthand } from '../core/ingredients/shorthand';
import type { MepDatabase } from './db';
import { createKitchen, setPlace } from './kitchens';
import { createComponent, getComponentDetails, getVariationInUse, saveLines, saveSteps } from './library';
import { listComponentNotes } from './notes';
import { restoreSnapshot } from './snapshot';
import { addAttempt, compareVariations, createVariation, deleteVariation, forkVariation, listVariations, setSuggestedToChef } from './variations';
import { getVersionContent, listVersions, restoreVersion, undoRestore, WRITE_SESSION_MINUTES } from './versions';
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

/** Pretends the chef walked away from the recipe: the current version is now old. */
async function walkAway(variationId: string) {
  const variation = (await db.variations.get(variationId))!;
  const long = new Date(Date.now() - (WRITE_SESSION_MINUTES + 5) * 60_000).toISOString();
  await db.versions.update(variation.currentVersionId!, { updatedAt: long });
}

async function beurreBlanc() {
  const id = await createComponent('Beurre blanc', kitchenId, db);
  const variation = (await getVariationInUse(id, kitchenId, db))!;
  await saveLines(variation.id, parseShorthand('butter 250g, shallots 2, white wine 100ml'), db);
  await saveSteps(variation.id, ['Reduce shallots and wine', 'Mount with butter to order'], db);
  return { id, variationId: variation.id };
}

describe('versions (V3)', () => {
  it('keeps one version per editing session, and a new one after a break', async () => {
    const { variationId } = await beurreBlanc();
    await saveLines(variationId, parseShorthand('butter 250g, shallots 3, white wine 100ml'), db);
    expect(await listVersions(variationId, db)).toHaveLength(1);

    await walkAway(variationId);
    await saveLines(variationId, parseShorthand('butter 300g, shallots 3, white wine 100ml, salt'), db);
    const versions = await listVersions(variationId, db);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({ isCurrent: true, changes: 'Butter 250g → 300g · added salt' });
    expect(versions[1]!.changes).toBe('First version');
    // The old version is untouched.
    expect((await getVersionContent(versions[1]!.version.id, db))!.lines.map((l) => l.amount)).toEqual(['250g', '3', '100ml']);
  });

  it('carries the method and its readings into the new version', async () => {
    const { id, variationId } = await beurreBlanc();
    await walkAway(variationId);
    await saveLines(variationId, parseShorthand('butter 300g'), db);
    const details = (await getComponentDetails(id, kitchenId, db))!;
    expect(details.steps.map((s) => s.text)).toEqual(['Reduce shallots and wine', 'Mount with butter to order']);
    expect(details.steps[0]!.parts[0]!.mode).toBe('check-in');
  });

  it('restores an old version as a new one, and the restore can be undone', async () => {
    const { id, variationId } = await beurreBlanc();
    await walkAway(variationId);
    await saveLines(variationId, parseShorthand('margarine 250g'), db);
    const [, first] = await listVersions(variationId, db);
    const { previousId, restoredId } = await restoreVersion(variationId, first!.version.id, db);
    expect((await getComponentDetails(id, kitchenId, db))!.lines.map((l) => l.name)).toEqual(['Butter', 'Shallots', 'White wine']);
    expect((await listVersions(variationId, db))[0]!.version.changeNote).toMatch(/^Restored the version from/);
    await undoRestore(variationId, previousId, restoredId, db);
    expect((await getComponentDetails(id, kitchenId, db))!.lines.map((l) => l.name)).toEqual(['Margarine']);
    expect(await listVersions(variationId, db)).toHaveLength(2);
  });
});

describe('variations (V1, V4, V5)', () => {
  it('forks the house recipe into my own, keeps the house one in use here, and shows either', async () => {
    const { id, variationId } = await beurreBlanc();
    const mine = await forkVariation(variationId, db);
    await saveLines(mine, parseShorthand('butter 250g, shallots 2, white wine 100ml, tarragon'), db);

    const list = await listVariations(id, kitchenId, db);
    expect(list.map((v) => [v.label, v.inUse])).toEqual([
      ['House · Dumbleton Hall', true],
      ['Mine', false],
    ]);
    expect((await getComponentDetails(id, kitchenId, db))!.lines).toHaveLength(3);
    expect((await getComponentDetails(id, kitchenId, db, mine))!.lines).toHaveLength(4);
    // My copy's steps start unconfirmed.
    expect((await getComponentDetails(id, kitchenId, db, mine))!.steps.every((s) => !s.confirmed)).toBe(true);
  });

  it('compares two variations side by side', async () => {
    const { variationId } = await beurreBlanc();
    const mine = await forkVariation(variationId, db);
    await saveLines(mine, parseShorthand('butter 300g, shallots 2, white wine 100ml, tarragon'), db);
    const compared = (await compareVariations(variationId, mine, db))!;
    expect(compared.rows.filter((r) => r.differs).map((r) => [r.name, r.a, r.b])).toEqual([
      ['Butter', '250g', '300g'],
      ['Tarragon', null, '✓'],
    ]);
  });

  it('keeps an idea with when it was suggested to chef', async () => {
    const { id } = await beurreBlanc();
    const idea = await createVariation(id, { source: 'idea', sourceDetail: 'from staff food', note: 'Brown the butter first' }, db);
    await setSuggestedToChef(idea, { on: '2026-11-25', response: 'Try it on Friday' }, db);
    expect(await db.variations.get(idea)).toMatchObject({ source: 'idea', note: 'Brown the butter first', suggestedToChef: { on: '2026-11-25' } });
  });

  it('deletes a variation with undo, but never the only one', async () => {
    const { id, variationId } = await beurreBlanc();
    await expect(deleteVariation(variationId, db)).rejects.toThrow(/only way/);
    const mine = await forkVariation(variationId, db);
    await addAttempt(id, mine, 'Too sharp: less vinegar', kitchenId, db);
    const snapshot = await deleteVariation(mine, db);
    expect(await listVariations(id, kitchenId, db)).toHaveLength(1);
    expect(await listComponentNotes(id, db)).toHaveLength(1);
    await restoreSnapshot(snapshot, db);
    expect(await listVariations(id, kitchenId, db)).toHaveLength(2);
  });
});

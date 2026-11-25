import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getBackupStatus, recordBackup } from './backup';
import type { MepDatabase } from './db';
import { exportData } from './exportData';
import { getCheckInDue, getThisWeeksGoal, setGoalText, setReflection } from './goals';
import { importData } from './importData';
import { createKitchen, setPlace } from './kitchens';
import {
  countInbox,
  createMediaNote,
  createTextNote,
  deleteNote,
  discardIfEmpty,
  listComponentNotes,
  listInbox,
  listKitchenNotes,
  returnToInbox,
  restoreNote,
  sortToKitchenNote,
  sortToNewComponent,
  updateNoteBody,
} from './notes';
import { freshDatabase } from './testing';
import { NO_KITCHEN_ID } from './types';
import { listWaste, logWaste, updateWaste } from './waste';

let db: MepDatabase;
beforeEach(async () => {
  db = await freshDatabase();
});
afterEach(async () => {
  await db.delete();
});

describe('capture', () => {
  it('tags a note with where the chef is', async () => {
    const kitchenId = await createKitchen('Dumbleton Hall', db);
    await setPlace(kitchenId, null, db);
    const id = await createTextNote('Q', db);
    await updateNoteBody(id, 'Quenelles three-sided here', db);
    expect(await db.notes.get(id)).toMatchObject({ kind: 'inbox', body: 'Quenelles three-sided here', kitchenId });
  });

  it('drops a note left empty', async () => {
    const id = await createTextNote('x', db);
    await updateNoteBody(id, '  ', db);
    await discardIfEmpty(id, db);
    expect(await countInbox(db)).toBe(0);
  });

  it('keeps photos with their note through export and import', async () => {
    await createMediaNote(new Blob(['jpeg bytes'], { type: 'image/jpeg' }), db);
    const target = await freshDatabase();
    await importData(await exportData(db), target);
    const [note] = await listInbox(target);
    const media = await target.media.get(note!.mediaIds[0]!);
    expect(await media?.blob.text()).toBe('jpeg bytes');
    expect(media?.type).toBe('image/jpeg');
    await target.delete();
  });
});

describe('inbox', () => {
  it('lists newest first', async () => {
    await db.notes.add({ kind: 'inbox', body: 'older', mediaIds: [], kitchenId: NO_KITCHEN_ID, sectionId: null, links: [], createdAt: '2026-11-23T10:00:00.000Z' });
    await db.notes.add({ kind: 'inbox', body: 'newer', mediaIds: [], kitchenId: NO_KITCHEN_ID, sectionId: null, links: [], createdAt: '2026-11-24T10:00:00.000Z' });
    expect((await listInbox(db)).map((n) => n.body)).toEqual(['newer', 'older']);
  });

  it('sorts a note into a kitchen note', async () => {
    const kitchenId = await createKitchen('Dumbleton Hall', db);
    await setPlace(kitchenId, null, db);
    const id = await createTextNote('Walk-in door sticks', db);
    await sortToKitchenNote(id, db);
    expect(await db.notes.get(id)).toMatchObject({ kind: 'kitchen', links: [{ kind: 'kitchen', id: kitchenId }] });
    expect(await countInbox(db)).toBe(0);
  });

  it('sorts a note into a new draft component', async () => {
    const id = await createTextNote('Beetroot gel: agar 2g per 250ml', db);
    const componentId = await sortToNewComponent(id, 'Beetroot gel', db);
    const variation = await db.variations.where('componentId').equals(componentId).first();
    expect(variation).toMatchObject({ status: 'draft', source: 'mine', kitchenId: null });
    expect(variation?.currentVersionId).toBeTruthy();
    expect((await db.notes.get(id))?.kind).toBe('attempt');
  });

  it('puts a deleted note back exactly with undo', async () => {
    const id = await createMediaNote(new Blob(['x'], { type: 'image/jpeg' }), db);
    const before = await db.notes.get(id);
    const deleted = await deleteNote(id, db);
    expect(await db.media.count()).toBe(0);
    await restoreNote(deleted!, db);
    expect(await db.notes.get(id)).toEqual(before);
    expect(await db.media.count()).toBe(1);
  });
});

describe('kitchen notes and component notes', () => {
  it('moves a kitchen note back to the inbox', async () => {
    const kitchenId = await createKitchen('Dumbleton Hall', db);
    await setPlace(kitchenId, null, db);
    const id = await createTextNote('Walk-in door sticks', db);
    await sortToKitchenNote(id, db);
    expect(await listKitchenNotes(kitchenId, db)).toHaveLength(1);
    await returnToInbox(id, db);
    expect(await db.notes.get(id)).toMatchObject({ kind: 'inbox', links: [] });
    expect(await listKitchenNotes(kitchenId, db)).toHaveLength(0);
  });

  it('finds the notes sorted into a component', async () => {
    const id = await createTextNote('Beetroot gel: agar 2g per 250ml', db);
    const componentId = await sortToNewComponent(id, 'Beetroot gel', db);
    expect((await listComponentNotes(componentId, db)).map((n) => n.id)).toEqual([id]);
  });
});

describe('waste', () => {
  it('corrects an entry without changing where or when', async () => {
    const id = await logWaste({ text: 'Trout', quantity: null, reasonId: null }, new Date(2026, 10, 24), db);
    await updateWaste(id, { text: 'Chalk stream trout', quantity: { amount: 3, unit: 'portion' }, reasonId: null }, db);
    expect(await db.wasteEntries.get(id)).toMatchObject({ text: 'Chalk stream trout', quantity: { amount: 3 }, date: '2026-11-24' });
  });

  it('logs what, how much and why, dated today', async () => {
    await logWaste({ text: ' Chalk stream trout ', quantity: { amount: 2, unit: 'portion' }, reasonId: null }, new Date(2026, 10, 24), db);
    expect((await listWaste(db))[0]).toMatchObject({ text: 'Chalk stream trout', date: '2026-11-24', cost: null });
  });
});

describe('weekly goal', () => {
  it('saves this week’s goal and asks about it the next week', async () => {
    const monday = new Date(2026, 10, 23);
    await setGoalText('2026-W48', 'Label everything before service', db);
    expect((await getThisWeeksGoal(monday, db))?.text).toBe('Label everything before service');
    const nextMonday = new Date(2026, 10, 30);
    expect((await getCheckInDue(nextMonday, db))?.week).toBe('2026-W48');
    await setReflection('2026-W48', 'Went well', db);
    expect(await getCheckInDue(nextMonday, db)).toBeUndefined();
  });
});

describe('backup reminder', () => {
  it('is not due with nothing to lose, due once there is, and resets on backup', async () => {
    expect((await getBackupStatus(new Date(), db)).due).toBe(false);
    await createTextNote('something worth keeping', db);
    expect((await getBackupStatus(new Date(), db)).due).toBe(true);
    await recordBackup(db);
    expect((await getBackupStatus(new Date(), db)).due).toBe(false);
    const eightDaysOn = new Date(Date.now() + 8 * 86_400_000);
    expect((await getBackupStatus(eightDaysOn, db)).due).toBe(true);
  });
});

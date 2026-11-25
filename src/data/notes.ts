/**
 * Captured notes and the inbox (C1–C3). A capture is saved the moment it's
 * made, tagged with where the chef is (kitchen, section) and when.
 */

import { db as appDb, type MepDatabase } from './db';
import { createDraftComponent } from './components';
import { getPlace } from './kitchens';
import type { Id, KitchenId, Media, Note } from './types';

// ─── Capture ──────────────────────────────────────────────────────────────

/** Starts a text note in the inbox. Called on the first keystroke. */
export async function createTextNote(body: string, database: MepDatabase = appDb): Promise<Id> {
  const { kitchenId } = await getPlace(database);
  const sectionId = null; // not asked any more (DECISIONS 48)
  return database.notes.add({ kind: 'inbox', body, mediaIds: [], kitchenId, sectionId, links: [] });
}

/** Saves the text as it's typed. */
export async function updateNoteBody(id: Id, body: string, database: MepDatabase = appDb) {
  await database.notes.update(id, { body });
}

/** Removes a note that ended up empty (opened, typed, then cleared). */
export async function discardIfEmpty(id: Id, database: MepDatabase = appDb) {
  const note = await database.notes.get(id);
  if (note && !note.body.trim() && note.mediaIds.length === 0) await database.notes.delete(id);
}

/** A photo or voice note: stores the file and an inbox note pointing at it. */
export async function createMediaNote(blob: Blob, database: MepDatabase = appDb): Promise<Id> {
  const { kitchenId } = await getPlace(database);
  const sectionId = null; // not asked any more (DECISIONS 48)
  return database.transaction('rw', database.media, database.notes, async () => {
    const mediaId = await database.media.add({ blob, type: blob.type || 'application/octet-stream' });
    return database.notes.add({ kind: 'inbox', body: '', mediaIds: [mediaId], kitchenId, sectionId, links: [] });
  });
}

export function getMedia(id: Id, database: MepDatabase = appDb) {
  return database.media.get(id);
}

// ─── Inbox ────────────────────────────────────────────────────────────────

/** Inbox notes, newest first. */
export async function listInbox(database: MepDatabase = appDb): Promise<Note[]> {
  const notes = await database.notes.where('kind').equals('inbox').toArray();
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function countInbox(database: MepDatabase = appDb) {
  return database.notes.where('kind').equals('inbox').count();
}

/** Sort into a kitchen note: kept with the kitchen it was captured in. */
export async function sortToKitchenNote(id: Id, database: MepDatabase = appDb) {
  const note = await database.notes.get(id);
  if (!note) return;
  await database.notes.update(id, { kind: 'kitchen', links: [...note.links, { kind: 'kitchen', id: note.kitchenId }] });
}

/**
 * Sort into a new draft component. The note becomes the first dated note
 * on the new variation (an "attempt" note, SPEC → Variations and versions),
 * keeping its photo or voice note.
 */
export async function sortToNewComponent(id: Id, name: string, database: MepDatabase = appDb): Promise<Id> {
  return database.transaction('rw', database.tables, async () => {
    const note = await database.notes.get(id);
    if (!note) throw new Error('That note no longer exists.');
    const { componentId, variationId } = await createDraftComponent(name, note.kitchenId, database);
    await database.notes.update(id, {
      kind: 'attempt',
      links: [...note.links, { kind: 'component', id: componentId }, { kind: 'variation', id: variationId }],
    });
    return componentId;
  });
}

/** Undo a sort into kitchen notes: back to the inbox, unattached. */
export async function returnToInbox(id: Id, database: MepDatabase = appDb) {
  const note = await database.notes.get(id);
  if (!note) return;
  await database.notes.update(id, { kind: 'inbox', links: note.links.filter((link) => link.kind !== 'kitchen') });
}

/** The notes attached to a component (sorted into it from the inbox), newest first. */
export async function listComponentNotes(componentId: Id, database: MepDatabase = appDb): Promise<Note[]> {
  const notes = await database.notes
    .where('kind')
    .equals('attempt')
    .filter((n) => n.links.some((link) => link.kind === 'component' && link.id === componentId))
    .toArray();
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getNote(id: Id, database: MepDatabase = appDb) {
  return database.notes.get(id);
}

/** Kitchen notes for one kitchen, newest first. */
export async function listKitchenNotes(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Note[]> {
  const notes = await database.notes.where('kitchenId').equals(kitchenId).filter((n) => n.kind === 'kitchen').toArray();
  return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Delete with undo ─────────────────────────────────────────────────────

/** Everything needed to put a deleted note back exactly as it was. */
export interface DeletedNote {
  note: Note;
  media: Media[];
}

export async function deleteNote(id: Id, database: MepDatabase = appDb): Promise<DeletedNote | undefined> {
  return database.transaction('rw', database.notes, database.media, async () => {
    const note = await database.notes.get(id);
    if (!note) return undefined;
    const media = (await database.media.bulkGet(note.mediaIds)).filter((m): m is Media => m !== undefined);
    await database.media.bulkDelete(note.mediaIds);
    await database.notes.delete(id);
    return { note, media };
  });
}

/** Undo: puts the note and its media back with their original ids and times. */
export async function restoreNote(deleted: DeletedNote, database: MepDatabase = appDb) {
  await database.transaction('rw', database.notes, database.media, async () => {
    await database.media.bulkPut(deleted.media);
    await database.notes.put(deleted.note);
  });
}

/**
 * Tags and collections (R3, SPEC → Types and tags). Tags are the chef's own
 * editable list (ListValue 'tags'), so renaming or merging a tag changes it
 * everywhere. Collections are named groups the chef makes ("Christmas ideas").
 */

import { namesMatch } from '../core/ingredients/names';
import { cleanName } from '../core/lists/lists';
import { db as appDb, type MepDatabase } from './db';
import { addListItem, getListItems, ListError } from './lists';
import type { Collection, CollectionMember, Id } from './types';

const TAGS = { kind: 'values', list: 'tags', kitchenId: null } as const;

/** Visible tags, in order. */
export async function listTags(database: MepDatabase = appDb) {
  return (await getListItems(TAGS, database)).filter((t) => !t.hidden);
}

/** All tags including hidden ones, by id: for showing names on existing items. */
export async function tagNames(database: MepDatabase = appDb): Promise<Map<Id, string>> {
  return new Map((await getListItems(TAGS, database)).map((t) => [t.id, t.name]));
}

/** The tag with this name (ignoring case and plurals), created if new. */
export async function ensureTag(name: string, database: MepDatabase = appDb): Promise<Id> {
  const existing = (await listTags(database)).find((t) => namesMatch(t.name, name));
  return existing ? existing.id : addListItem(TAGS, name.trim().toLowerCase(), database);
}

// ─── Collections ──────────────────────────────────────────────────────────

export async function listCollections(database: MepDatabase = appDb): Promise<Collection[]> {
  return (await database.collections.toArray()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCollection(name: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the collection a name.');
  const existing = (await listCollections(database)).find((c) => namesMatch(c.name, cleaned));
  if (existing) throw new ListError(`"${existing.name}" already exists.`);
  return database.collections.add({ name: cleaned, members: [] });
}

/** Adds the item to the collection, or takes it out if it's already in. */
export async function toggleInCollection(collectionId: Id, member: CollectionMember, database: MepDatabase = appDb) {
  const collection = await database.collections.get(collectionId);
  if (!collection) return;
  const inIt = collection.members.some((m) => m.kind === member.kind && m.id === member.id);
  await database.collections.update(collectionId, {
    members: inIt ? collection.members.filter((m) => !(m.kind === member.kind && m.id === member.id)) : [...collection.members, member],
  });
}

export async function deleteCollection(id: Id, database: MepDatabase = appDb) {
  const collection = await database.collections.get(id);
  await database.collections.delete(id);
  return collection;
}

export async function restoreCollection(collection: Collection, database: MepDatabase = appDb) {
  await database.collections.put(collection);
}

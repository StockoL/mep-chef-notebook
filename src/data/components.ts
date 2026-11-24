/**
 * Components (SPEC → Components). Phase 1 only creates drafts from inbox
 * notes and lists them; Phase 2 builds the full library.
 */

import { cleanName } from '../core/lists/lists';
import { db as appDb, type MepDatabase } from './db';
import { ListError } from './lists';
import { NO_KITCHEN_ID, type Component, type Id, type KitchenId } from './types';

/**
 * A new component with one draft variation: the house variation of the
 * kitchen it came from, or the chef's own with no kitchen (BUILD_ORDER →
 * Phase 2: "house for the current kitchen, or mine").
 */
export async function createDraftComponent(
  name: string,
  kitchenId: KitchenId,
  database: MepDatabase = appDb,
): Promise<{ componentId: Id; variationId: Id }> {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the component a name.');
  const inKitchen = kitchenId !== NO_KITCHEN_ID;

  return database.transaction('rw', database.components, database.variations, database.versions, async () => {
    const componentId = await database.components.add({ name: cleaned, typeId: null, tagIds: [], aliases: [] });
    const variationId = await database.variations.add({
      componentId,
      source: inKitchen ? 'house' : 'mine',
      sourceDetail: null,
      kitchenId: inKitchen ? kitchenId : null,
      forkedFromId: null,
      status: 'draft',
      baseYield: null,
      note: '',
      suggestedToChef: null,
      currentVersionId: null,
    });
    const versionId = await database.versions.add({ variationId, parentId: null, changeNote: 'Created from a note' });
    await database.variations.update(variationId, { currentVersionId: versionId });
    return { componentId, variationId };
  });
}

/** All components by name. */
export async function listComponents(database: MepDatabase = appDb): Promise<Component[]> {
  return database.components.orderBy('name').toArray();
}

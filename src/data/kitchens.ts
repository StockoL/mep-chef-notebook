/**
 * Kitchens, and where the chef is now (K1–K3, K5).
 * "Where" = the current kitchen and section, kept in settings so the app
 * reopens where it was.
 */

import { cleanName } from '../core/lists/lists';
import { nextService, type NextService } from '../core/services/nextService';
import { isoDayOfWeek, toCalendarDate } from '../core/time/calendar';
import { eventInputs } from './events';
import { db as appDb, type MepDatabase } from './db';
import { seedKitchen } from './defaults';
import { ListError } from './lists';
import { getSetting, setSetting } from './settings';
import { NO_KITCHEN_ID, type Id, type Kitchen, type KitchenId, type Section, type Service, type ShiftPattern } from './types';

// ─── Kitchens ─────────────────────────────────────────────────────────────

/** "No kitchen" first, then the rest by name; archived ones last. */
export async function listKitchens(database: MepDatabase = appDb): Promise<Kitchen[]> {
  const kitchens = await database.kitchens.toArray();
  return kitchens.sort((a, b) => {
    if (a.builtIn !== b.builtIn) return a.builtIn ? -1 : 1;
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function getKitchen(id: Id, database: MepDatabase = appDb) {
  return database.kitchens.get(id);
}

/** Creates a kitchen with its starting sections, services and lists. */
export async function createKitchen(name: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the kitchen a name.');
  return database.transaction('rw', database.tables, async () => {
    const id = await database.kitchens.add({
      name: cleaned,
      archived: false,
      sheetName: "Today's sheet",
      builtIn: false,
      usualSectionId: null,
    });
    await seedKitchen(database, id);
    return id;
  });
}

export async function renameKitchen(id: Id, name: string, database: MepDatabase = appDb) {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the kitchen a name.');
  await guardBuiltIn(id, database);
  await database.kitchens.update(id, { name: cleaned });
}

/** Archived kitchens keep their notes and recipes; they leave the switcher. */
export async function setKitchenArchived(id: Id, archived: boolean, database: MepDatabase = appDb) {
  await guardBuiltIn(id, database);
  await database.kitchens.update(id, { archived });
  if (archived && (await getPlace(database)).kitchenId === id) {
    await setPlace(NO_KITCHEN_ID, database);
  }
}

export async function setUsualSection(kitchenId: KitchenId, sectionId: Id | null, database: MepDatabase = appDb) {
  await database.kitchens.update(kitchenId, { usualSectionId: sectionId });
}

async function guardBuiltIn(id: Id, database: MepDatabase) {
  const kitchen = await database.kitchens.get(id);
  if (kitchen?.builtIn) throw new ListError('"No kitchen" is built in and can’t be changed.');
}

// ─── Where the chef is ────────────────────────────────────────────────────

const PLACE_KEY = 'place';

/**
 * Where the chef works: the kitchen. Which section they're on isn't asked
 * (DECISIONS 48): today's sheet is the kitchen's, and a section's list is
 * picked when it's needed. Older saved places may still carry a sectionId;
 * it's ignored.
 */
export interface Place {
  kitchenId: KitchenId;
}

/** The current kitchen; "No kitchen" if the saved one is gone or archived. */
export async function getPlace(database: MepDatabase = appDb): Promise<Place> {
  const saved = await getSetting<Place>(PLACE_KEY, database);
  if (!saved) return { kitchenId: NO_KITCHEN_ID };
  const kitchen = await database.kitchens.get(saved.kitchenId);
  if (!kitchen || kitchen.archived) return { kitchenId: NO_KITCHEN_ID };
  return { kitchenId: saved.kitchenId };
}

/** Moves the chef to a kitchen. */
export async function setPlace(kitchenId: KitchenId, database: MepDatabase = appDb) {
  await setSetting<Place>(PLACE_KEY, { kitchenId }, database);
}

/** The current kitchen as a row, for the top bar. */
export async function getPlaceDetails(database: MepDatabase = appDb) {
  const place = await getPlace(database);
  const kitchen = await database.kitchens.get(place.kitchenId);
  return { place, kitchen };
}

// ─── Sections, services and shifts of one kitchen ─────────────────────────

/** Visible sections, in order. */
export async function listSections(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Section[]> {
  const sections = await database.sections.where('kitchenId').equals(kitchenId).toArray();
  return sections.filter((s) => !s.hidden && s.mergedIntoId === null).sort((a, b) => a.order - b.order);
}

/** Every service still on the list (hidden ones too), in order. */
export async function listServices(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<Service[]> {
  const services = await database.services.where('kitchenId').equals(kitchenId).toArray();
  return services.filter((s) => s.mergedIntoId === null).sort((a, b) => a.order - b.order);
}

export function getService(id: Id, database: MepDatabase = appDb) {
  return database.services.get(id);
}

export async function updateService(
  id: Id,
  changes: Partial<Pick<Service, 'iWorkThis' | 'windows'>>,
  database: MepDatabase = appDb,
) {
  await database.services.update(id, changes);
}

export async function listShifts(kitchenId: KitchenId, database: MepDatabase = appDb): Promise<ShiftPattern[]> {
  return database.shiftPatterns.where('kitchenId').equals(kitchenId).sortBy('createdAt');
}

export function addShift(kitchenId: KitchenId, database: MepDatabase = appDb) {
  return database.shiftPatterns.add({ kitchenId, start: '10:00', end: '22:30', days: [1, 2, 3, 4, 5] });
}

export async function updateShift(
  id: Id,
  changes: Partial<Pick<ShiftPattern, 'start' | 'end' | 'days'>>,
  database: MepDatabase = appDb,
) {
  await database.shiftPatterns.update(id, changes);
}

export async function deleteShift(id: Id, database: MepDatabase = appDb) {
  await database.shiftPatterns.delete(id);
}

/** The service on now or next in a kitchen, for Today (K5). */
export async function getNextService(
  kitchenId: KitchenId,
  now: Date,
  database: MepDatabase = appDb,
): Promise<NextService | null> {
  const events = await eventInputs(kitchenId, toCalendarDate(now), database);
  return nextService(await listServices(kitchenId, database), now, events);
}

/**
 * Each service the chef works on a date, with its usual first-tickets time and
 * any one-off change for that day (for "change today's times", K6).
 */
export async function getServiceTimesOn(kitchenId: KitchenId, date: Date, database: MepDatabase = appDb) {
  const day = isoDayOfWeek(date);
  const calendarDate = toCalendarDate(date);
  const events = await database.events.where('[kitchenId+date]').equals([kitchenId, calendarDate]).toArray();
  const services = (await listServices(kitchenId, database)).filter((s) => s.iWorkThis && !s.hidden);
  return Promise.all(
    services.map(async (service) => {
      const window = service.windows.find((w) => w.days.includes(day as never));
      const change = events.find((e) => e.replacesServiceId === service.id);
      const changed = change ? await database.eventServices.where('eventId').equals(change.id).first() : undefined;
      return {
        service,
        usualStart: window?.firstTickets ?? null,
        usualEnd: window?.lastBookings ?? null,
        changedStart: changed?.start ?? null,
        changedBy: change?.name ?? null,
      };
    }),
  );
}

/**
 * Events (K6): a wedding, function or party with its own service times and
 * covers, or a one-off time change ("dinner at 19:00 tonight"). An event
 * replaces one usual service that day, or runs alongside them.
 */

import type { EventInput } from '../core/services/nextService';
import { cleanName } from '../core/lists/lists';
import { db as appDb, type MepDatabase } from './db';
import { ListError } from './lists';
import type { Snapshot } from './snapshot';
import type { CalendarDate, Event, EventService, Id, KitchenId, TimeOfDay } from './types';

export interface EventDetails {
  event: Event;
  services: EventService[];
}

/** A kitchen's events from a date on (today and later by default), soonest first. */
export async function listEvents(kitchenId: KitchenId, fromDate: CalendarDate, database: MepDatabase = appDb): Promise<EventDetails[]> {
  const events = await database.events
    .where('[kitchenId+date]')
    .between([kitchenId, fromDate], [kitchenId, '\uffff'])
    .toArray();
  return Promise.all(
    events
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(async (event) => ({ event, services: await database.eventServices.where('eventId').equals(event.id).sortBy('start') })),
  );
}

export async function getEvent(id: Id, database: MepDatabase = appDb): Promise<EventDetails | undefined> {
  const event = await database.events.get(id);
  if (!event) return undefined;
  return { event, services: await database.eventServices.where('eventId').equals(id).sortBy('start') };
}

/** The events from a date on, in the shape the next-service calculation takes. */
export async function eventInputs(kitchenId: KitchenId, fromDate: CalendarDate, database: MepDatabase = appDb): Promise<EventInput[]> {
  return (await listEvents(kitchenId, fromDate, database)).map(({ event, services }) => ({
    date: event.date,
    replacesServiceId: event.replacesServiceId,
    services: services.map((s) => ({ id: s.id, name: s.name, start: s.start, end: s.end })),
  }));
}

export async function createEvent(kitchenId: KitchenId, date: CalendarDate, name: string, database: MepDatabase = appDb): Promise<Id> {
  const cleaned = cleanName(name);
  if (!cleaned) throw new ListError('Give the event a name.');
  return database.events.add({ kitchenId, date, name: cleaned, covers: null, notes: '', replacesServiceId: null, menuId: null });
}

export async function updateEvent(
  id: Id,
  changes: Partial<Pick<Event, 'date' | 'name' | 'covers' | 'notes' | 'replacesServiceId'>>,
  database: MepDatabase = appDb,
) {
  if (changes.name !== undefined) {
    const name = cleanName(changes.name);
    if (!name) throw new ListError('Give the event a name.');
    changes = { ...changes, name };
  }
  await database.events.update(id, changes);
}

export function addEventService(eventId: Id, name: string, start: TimeOfDay, database: MepDatabase = appDb) {
  return database.eventServices.add({ eventId, name: cleanName(name) || 'Service', start, end: null });
}

export async function updateEventService(id: Id, changes: Partial<Pick<EventService, 'name' | 'start' | 'end'>>, database: MepDatabase = appDb) {
  await database.eventServices.update(id, changes);
}

export async function removeEventService(id: Id, database: MepDatabase = appDb) {
  await database.eventServices.delete(id);
}

/** Deletes an event and its service times. Returns what Undo needs. */
export async function deleteEvent(id: Id, database: MepDatabase = appDb): Promise<Snapshot> {
  return database.transaction('rw', database.events, database.eventServices, async () => {
    const event = await database.events.get(id);
    const services = await database.eventServices.where('eventId').equals(id).toArray();
    await database.events.delete(id);
    await database.eventServices.bulkDelete(services.map((s) => s.id));
    return { events: event ? [event] : [], eventServices: services };
  });
}

/**
 * A one-off time change for one service on one date ("dinner at 19:00
 * tonight"): a small event replacing that service. Setting it again updates
 * it; `start` null removes it, back to the usual time.
 */
export async function setTimeChange(
  kitchenId: KitchenId,
  date: CalendarDate,
  service: { id: Id; name: string },
  start: TimeOfDay | null,
  end: TimeOfDay | null,
  database: MepDatabase = appDb,
): Promise<void> {
  await database.transaction('rw', database.events, database.eventServices, async () => {
    const existing = await database.events
      .where('[kitchenId+date]')
      .equals([kitchenId, date])
      .filter((e) => e.replacesServiceId === service.id && e.name === timeChangeName(service.name))
      .first();
    if (existing) {
      await database.eventServices.where('eventId').equals(existing.id).delete();
      await database.events.delete(existing.id);
    }
    if (!start) return;
    const eventId = await database.events.add({
      kitchenId,
      date,
      name: timeChangeName(service.name),
      covers: null,
      notes: '',
      replacesServiceId: service.id,
      menuId: null,
    });
    await database.eventServices.add({ eventId, name: service.name, start, end });
  });
}

function timeChangeName(serviceName: string) {
  return `${serviceName} time change`;
}

/**
 * Which service is next for the chef (K5): the one on now, or the next one
 * to start, looking up to a week ahead. Only services the chef works count.
 * Events (K6) change a date's pattern: they replace a usual service or run
 * alongside it, with their own times.
 */

import { isoDayOfWeek, minutesOfDay, timeToMinutes, toCalendarDate } from '../time/calendar';

/** One stretch of a service on given days: first tickets to last bookings. */
export interface ServiceWindowInput {
  /** 1 (Monday) to 7 (Sunday). */
  days: number[];
  firstTickets: string | null;
  lastBookings: string | null;
}

export interface ServiceInput {
  id: string;
  name: string;
  iWorkThis: boolean;
  hidden: boolean;
  windows: ServiceWindowInput[];
}

/** An event on one date: a wedding, or a one-off time change ("dinner at 19:00 tonight"). */
export interface EventInput {
  /** "YYYY-MM-DD" */
  date: string;
  /** The usual service it replaces that day; null = runs alongside. */
  replacesServiceId: string | null;
  services: { id: string; name: string; start: string; end: string | null }[];
}

export interface NextService {
  serviceId: string;
  name: string;
  /** 0 = today, 1 = tomorrow… */
  daysAhead: number;
  firstTickets: string;
  lastBookings: string | null;
  /** True when it's running right now. */
  onNow: boolean;
  /** True when it comes from an event rather than the usual pattern. */
  fromEvent: boolean;
}

interface Candidate {
  id: string;
  name: string;
  start: string;
  end: string | null;
  fromEvent: boolean;
}

/** Every service the chef works on one date, after that date's events. */
export function servicesOn(date: Date, services: ServiceInput[], events: EventInput[] = []): Candidate[] {
  const day = isoDayOfWeek(date);
  const calendarDate = toCalendarDate(date);
  const todaysEvents = events.filter((e) => e.date === calendarDate);
  const replaced = new Set(todaysEvents.map((e) => e.replacesServiceId).filter((id) => id !== null));

  const usual = services
    .filter((s) => s.iWorkThis && !s.hidden && !replaced.has(s.id))
    .flatMap((s) =>
      s.windows
        .filter((w) => w.firstTickets && w.days.includes(day))
        .map((w) => ({ id: s.id, name: s.name, start: w.firstTickets!, end: w.lastBookings, fromEvent: false })),
    );
  const fromEvents = todaysEvents.flatMap((e) => e.services.map((s) => ({ ...s, fromEvent: true })));
  return [...usual, ...fromEvents].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

/** The service on now or next, from `now`; null if the chef works none in the next week. */
export function nextService(services: ServiceInput[], now: Date, events: EventInput[] = []): NextService | null {
  const nowMinutes = minutesOfDay(now);

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
    for (const candidate of servicesOn(date, services, events)) {
      const start = timeToMinutes(candidate.start);
      const end = candidate.end ? timeToMinutes(candidate.end) : start;
      // Today, a service only counts until its last bookings.
      if (daysAhead === 0 && end < nowMinutes) continue;
      return {
        serviceId: candidate.id,
        name: candidate.name,
        daysAhead,
        firstTickets: candidate.start,
        lastBookings: candidate.end,
        onNow: daysAhead === 0 && start <= nowMinutes && nowMinutes <= end,
        fromEvent: candidate.fromEvent,
      };
    }
  }
  return null;
}

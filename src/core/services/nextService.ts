/**
 * Which service is next for the chef (K5): the one on now, or the next one
 * to start, looking up to a week ahead. Only services the chef works count.
 */

import { isoDayOfWeek, minutesOfDay, timeToMinutes } from '../time/calendar';

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

export interface NextService {
  serviceId: string;
  name: string;
  /** 0 = today, 1 = tomorrow… */
  daysAhead: number;
  firstTickets: string;
  lastBookings: string | null;
  /** True when it's running right now. */
  onNow: boolean;
}

/**
 * The service on now or next, from `now`; null if the chef works none.
 * A window with no first-tickets time is skipped (not set up yet).
 */
export function nextService(services: ServiceInput[], now: Date): NextService | null {
  const nowMinutes = minutesOfDay(now);
  const today = isoDayOfWeek(now);

  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const day = ((today - 1 + daysAhead) % 7) + 1;
    let best: NextService | null = null;

    for (const service of services) {
      if (!service.iWorkThis || service.hidden) continue;
      for (const window of service.windows) {
        if (!window.firstTickets || !window.days.includes(day)) continue;
        const start = timeToMinutes(window.firstTickets);
        const end = window.lastBookings ? timeToMinutes(window.lastBookings) : start;
        // Today, a service only counts until its last bookings.
        if (daysAhead === 0 && end < nowMinutes) continue;
        const candidate: NextService = {
          serviceId: service.id,
          name: service.name,
          daysAhead,
          firstTickets: window.firstTickets,
          lastBookings: window.lastBookings,
          onNow: daysAhead === 0 && start <= nowMinutes && nowMinutes <= end,
        };
        if (!best || start < timeToMinutes(best.firstTickets)) best = candidate;
      }
    }
    if (best) return best;
  }
  return null;
}

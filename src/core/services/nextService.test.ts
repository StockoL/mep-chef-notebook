import { describe, expect, it } from 'vitest';
import { nextService, servicesOn, type ServiceInput } from './nextService';

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

// Dumbleton Hall (seed/dumbleton-hall.json): lunch 12:00–16:30, dinner 18:00–20:15.
const services: ServiceInput[] = [
  { id: 'b', name: 'Breakfast', iWorkThis: false, hidden: false, windows: [{ days: EVERY_DAY, firstTickets: '07:00', lastBookings: '10:00' }] },
  { id: 'l', name: 'Lunch', iWorkThis: true, hidden: false, windows: [{ days: EVERY_DAY, firstTickets: '12:00', lastBookings: '16:30' }] },
  { id: 'd', name: 'Dinner', iWorkThis: true, hidden: false, windows: [{ days: EVERY_DAY, firstTickets: '18:00', lastBookings: '20:15' }] },
];

const at = (day: number, time: string) => {
  const [h, m] = time.split(':').map(Number);
  return new Date(2026, 10, 22 + day, h, m); // 23 Nov 2026 is a Monday (day 1)
};

describe('nextService', () => {
  it('finds the next service to start today', () => {
    expect(nextService(services, at(1, '10:00'))).toMatchObject({ name: 'Lunch', daysAhead: 0, onNow: false });
  });

  it('skips services the chef does not work', () => {
    expect(nextService(services, at(1, '06:00'))?.name).toBe('Lunch');
  });

  it('says a service is on now until last bookings', () => {
    expect(nextService(services, at(1, '13:00'))).toMatchObject({ name: 'Lunch', onNow: true });
    expect(nextService(services, at(1, '16:45'))).toMatchObject({ name: 'Dinner', onNow: false });
  });

  it('rolls over to tomorrow after the last service', () => {
    expect(nextService(services, at(1, '21:00'))).toMatchObject({ name: 'Lunch', daysAhead: 1 });
  });

  it('uses the window for the right day', () => {
    const sundayLunch: ServiceInput[] = [
      {
        id: 'l',
        name: 'Lunch',
        iWorkThis: true,
        hidden: false,
        windows: [
          { days: [1, 2, 3, 4, 5, 6], firstTickets: '12:00', lastBookings: '14:30' },
          { days: [7], firstTickets: '12:30', lastBookings: '16:30' },
        ],
      },
    ];
    expect(nextService(sundayLunch, at(7, '09:00'))).toMatchObject({ firstTickets: '12:30', lastBookings: '16:30' });
    expect(nextService(sundayLunch, at(6, '15:00'))).toMatchObject({ daysAhead: 1, firstTickets: '12:30' });
  });

  it('skips days the service does not run', () => {
    const weekdays: ServiceInput[] = [
      { id: 'l', name: 'Lunch', iWorkThis: true, hidden: false, windows: [{ days: [1, 2, 3, 4, 5], firstTickets: '12:00', lastBookings: '14:00' }] },
    ];
    expect(nextService(weekdays, at(5, '15:00'))).toMatchObject({ daysAhead: 3 }); // Friday → Monday
  });

  it('returns null when nothing is set up', () => {
    expect(nextService([], at(1, '10:00'))).toBeNull();
    expect(nextService([{ ...services[1]!, hidden: true }], at(1, '10:00'))).toBeNull();
  });
});

describe('events change the day', () => {
  const tuesday = '2026-11-24';

  it('a one-off time change replaces the usual service', () => {
    const events = [{ date: tuesday, replacesServiceId: 'd', services: [{ id: 'e1', name: 'Dinner', start: '19:00', end: '21:00' }] }];
    expect(nextService(services, at(2, '17:00'), events)).toMatchObject({ name: 'Dinner', firstTickets: '19:00', fromEvent: true });
    // The usual 18:00 dinner doesn't also appear.
    expect(servicesOn(at(2, '00:00'), services, events).map((s) => s.start)).toEqual(['12:00', '19:00']);
  });

  it('an event can run alongside the usual services', () => {
    const events = [{ date: tuesday, replacesServiceId: null, services: [{ id: 'w1', name: 'Wedding canapés', start: '15:00', end: '16:00' }] }];
    expect(servicesOn(at(2, '00:00'), services, events).map((s) => s.name)).toEqual(['Lunch', 'Wedding canapés', 'Dinner']);
  });

  it('only affects its own date', () => {
    const events = [{ date: tuesday, replacesServiceId: 'l', services: [] }];
    expect(nextService(services, at(3, '10:00'), events)?.name).toBe('Lunch'); // Wednesday
  });
});

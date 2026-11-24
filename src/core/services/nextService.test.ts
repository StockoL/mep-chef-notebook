import { describe, expect, it } from 'vitest';
import { nextService, type ServiceInput } from './nextService';

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

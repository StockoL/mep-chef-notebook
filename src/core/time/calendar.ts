/**
 * Calendar helpers. Everything here works in the chef's local time: a shift
 * on Monday is Monday wherever the phone thinks UTC is.
 */

/** "2026-11-24" for a local date. */
export function toCalendarDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 1 (Monday) to 7 (Sunday), as stored in the data (ISO). JS's getDay() has Sunday = 0. */
export function isoDayOfWeek(date: Date): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** Minutes since midnight → "HH:MM": 605 → "10:05". Wraps past midnight. */
export function minutesToTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "HH:MM" → minutes since midnight: "12:30" → 750. */
export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Not a time of day: "${time}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes since midnight for a Date, in local time. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * The ISO week a date falls in: "2026-W48". Weeks start on Monday, and week 1
 * is the week with the year's first Thursday, so early-January days can belong
 * to the previous year's last week.
 */
export function isoWeek(date: Date): string {
  // Work on the Thursday of this week: its year is the week's year.
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  thursday.setDate(thursday.getDate() + 4 - isoDayOfWeek(thursday));
  const year = thursday.getFullYear();
  const firstOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.round((thursday.getTime() - firstOfYear.getTime()) / 86_400_000);
  const week = Math.floor(dayOfYear / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** The ISO week before the one given: "2026-W01" → "2025-W52" (or W53). */
export function previousIsoWeek(date: Date): string {
  const lastWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7);
  return isoWeek(lastWeek);
}

/** Whole days from one moment to another, rounded down: for "backed up 3 days ago". */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

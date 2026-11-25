/** Dates and times as the chef reads them (UK English). */

import { toCalendarDate } from '../core/time/calendar';

/** "14:32" today, "Yesterday 14:32", "Mon 23 Nov 14:32" otherwise. */
export function formatWhen(timestamp: string, now = new Date()): string {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day = toCalendarDate(date);
  if (day === toCalendarDate(now)) return time;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (day === toCalendarDate(yesterday)) return `Yesterday ${time}`;
  return `${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

/** "Mon 23 Nov" for a "YYYY-MM-DD" date. */
export function formatCalendarDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "today", "yesterday", "3 days ago". */
export function formatDaysAgo(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** "0:07", "1:30", "12:05": a running stopwatch. */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** "Mon–Fri", "Sat, Sun", "Every day" for ISO days 1–7. */
export function formatDays(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 0) return 'No days';
  const isRun = sorted.length >= 3 && sorted.every((day, i) => i === 0 || day === sorted[i - 1]! + 1);
  if (isRun) return `${DAY_NAMES[sorted[0]! - 1]}–${DAY_NAMES[sorted.at(-1)! - 1]}`;
  return sorted.map((day) => DAY_NAMES[day - 1]).join(', ');
}

/** "today", "tomorrow" or the weekday name, for something `daysAhead` days away. */
export function formatDayAhead(daysAhead: number, now = new Date()): string {
  if (daysAhead === 0) return 'today';
  if (daysAhead === 1) return 'tomorrow';
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
  return day.toLocaleDateString('en-GB', { weekday: 'long' });
}

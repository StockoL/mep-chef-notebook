/**
 * When a menu is served (DECISIONS 57): days of the week and services, each
 * empty for "every". A Sunday lunch menu is days [7] with the Lunch service.
 * Pure, so the library, Today and the menu screens all agree.
 */

export interface ServedWhen {
  /** 1–7 from Monday; empty = every day. */
  days: readonly number[];
  /** The kitchen's service ids; empty = every service. */
  serviceIds: readonly string[];
}

const DAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Served on this day (1–7), at this service if one is given. */
export function servedAt(menu: ServedWhen, day: number, serviceId?: string | null): boolean {
  const onDay = menu.days.length === 0 || menu.days.includes(day);
  const atService = !serviceId || menu.serviceIds.length === 0 || menu.serviceIds.includes(serviceId);
  return onDay && atService;
}

/** "Sundays", "Mon–Fri", "Sat and Sun", "Mon, Wed, Fri"; "" for every day. */
export function daysLabel(days: readonly number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 0 || sorted.length === 7) return '';
  if (sorted.length === 1) return DAY_NAMES[sorted[0]! - 1]!;
  const run = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (run && sorted.length > 2) return `${SHORT[sorted[0]! - 1]}–${SHORT[sorted.at(-1)! - 1]}`;
  const names = sorted.map((d) => SHORT[d - 1]!);
  return sorted.length === 2 ? `${names[0]} and ${names[1]}` : names.join(', ');
}

/** "Sundays · Lunch", "Dinner", "Every day". */
export function servedLabel(menu: ServedWhen, serviceNames: ReadonlyMap<string, string>): string {
  const services = menu.serviceIds.map((id) => serviceNames.get(id)).filter((n): n is string => Boolean(n));
  const parts = [daysLabel(menu.days), services.join(' and ')].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Every day';
}

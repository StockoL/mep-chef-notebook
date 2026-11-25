import type { IconName } from './icons';

/**
 * Where the app lives: "/mep-chef-notebook/" (vite.config.ts → base).
 * Vite puts it on import.meta.env, so it's never written out twice.
 */
export const BASE = import.meta.env.BASE_URL;

/** Every route's full path. Use these instead of typing paths by hand. */
export const paths = {
  today: BASE,
  inbox: `${BASE}inbox`,
  notes: `${BASE}notes`,
  sheets: `${BASE}sheets`,
  sheet: (id: string) => `${BASE}sheet/${id}`,
  sheetPaper: (date: string) => `${BASE}sheet/paper?date=${date}`,
  sectionList: `${BASE}section/list`,
  events: (kitchenId: string) => `${BASE}kitchen/${kitchenId}/events`,
  event: (kitchenId: string, eventId: string) => `${BASE}kitchen/${kitchenId}/events/${eventId}`,
  notesFor: (kitchenId: string) => `${BASE}notes?kitchen=${kitchenId}`,
  library: `${BASE}library`,
  librarySearch: `${BASE}library?search=1`,
  component: (id: string) => `${BASE}library/component/${id}`,
  dish: (id: string) => `${BASE}library/dish/${id}`,
  ingredient: (id: string) => `${BASE}library/ingredient/${id}`,
  plan: `${BASE}plan`,
  section: `${BASE}section`,
  waste: `${BASE}section/waste`,
  goal: `${BASE}section/goal`,
  settings: `${BASE}settings`,
  settingsList: (list: string) => `${BASE}settings/lists/${list}`,
  kitchens: `${BASE}kitchens`,
  kitchen: (id: string) => `${BASE}kitchen/${id}`,
  kitchenSections: (id: string) => `${BASE}kitchen/${id}/sections`,
  kitchenServices: (id: string) => `${BASE}kitchen/${id}/services`,
  service: (kitchenId: string, serviceId: string) => `${BASE}kitchen/${kitchenId}/services/${serviceId}`,
  kitchenPart: (id: string, part: string) => `${BASE}kitchen/${id}/${part}`,
} as const;

/** Route patterns for preact-iso (":id" becomes a prop). */
export const routes = {
  settingsList: `${BASE}settings/lists/:list`,
  sheetPaper: `${BASE}sheet/paper`,
  sheet: `${BASE}sheet/:id`,
  events: `${BASE}kitchen/:id/events`,
  event: `${BASE}kitchen/:id/events/:eventId`,
  component: `${BASE}library/component/:id`,
  dish: `${BASE}library/dish/:id`,
  ingredient: `${BASE}library/ingredient/:id`,
  kitchen: `${BASE}kitchen/:id`,
  kitchenSections: `${BASE}kitchen/:id/sections`,
  kitchenServices: `${BASE}kitchen/:id/services`,
  service: `${BASE}kitchen/:id/services/:serviceId`,
  kitchenPart: `${BASE}kitchen/:id/:part`,
} as const;

/** One entry per bottom tab, in the order they appear. */
export interface Tab {
  path: string;
  label: string;
  icon: IconName;
  /** Other screens that belong to this tab (opened from it). */
  children?: string[];
}

export const tabs: readonly Tab[] = [
  { path: paths.today, label: 'Today', icon: 'home', children: [paths.inbox, paths.sheets, `${BASE}sheet`] },
  { path: paths.library, label: 'Library', icon: 'book' },
  { path: paths.plan, label: 'Plan', icon: 'clock' },
  { path: paths.section, label: 'Section', icon: 'list' },
];

/**
 * Is this tab the one we're in? Today matches only its own path (it's the
 * root of everything) and its children; the others also match anything below them.
 */
export function isTabActive(tab: Tab, currentPath: string): boolean {
  const under = (path: string) => currentPath === path || currentPath.startsWith(`${path}/`);
  if (tab.children?.some(under)) return true;
  if (tab.path === paths.today) return currentPath === paths.today;
  return under(tab.path);
}

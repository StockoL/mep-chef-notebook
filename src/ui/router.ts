import type { IconName } from './icons';

/**
 * Where the app lives: "/mep-chef-notebook/" (vite.config.ts → base).
 * Vite puts it on import.meta.env, so it's never written out twice.
 */
export const BASE = import.meta.env.BASE_URL;

/** Every route's full path. Use these instead of typing paths by hand. */
export const paths = {
  today: BASE,
  library: `${BASE}library`,
  plan: `${BASE}plan`,
  section: `${BASE}section`,
} as const;

/** One entry per bottom tab, in the order they appear. */
export interface Tab {
  path: string;
  label: string;
  icon: IconName;
}

export const tabs: readonly Tab[] = [
  { path: paths.today, label: 'Today', icon: 'home' },
  { path: paths.library, label: 'Library', icon: 'book' },
  { path: paths.plan, label: 'Plan', icon: 'clock' },
  { path: paths.section, label: 'Section', icon: 'list' },
];

/**
 * Is this tab the one we're in? Today only matches its own path exactly;
 * the others also match anything below them (later: /library/component/…).
 */
export function isTabActive(tab: Tab, currentPath: string): boolean {
  if (tab.path === paths.today) return currentPath === paths.today;
  return currentPath === tab.path || currentPath.startsWith(`${tab.path}/`);
}

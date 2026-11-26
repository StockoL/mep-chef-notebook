/**
 * Back goes where you came from. A page opened with `?from=menu:<id>` (a
 * dish tapped on a menu) or `?from=dish:<id>` (a recipe tapped on a dish)
 * goes back there, named; otherwise to the page's usual parent.
 */

import { useLocation } from 'preact-iso';
import { getDishDetails } from '../../data/library';
import { getMenu } from '../../data/menus';
import { paths } from '../router';
import { useLiveQuery } from './useLiveQuery';

export interface BackLink {
  href: string;
  label: string;
}

export function useBackLink(fallback: BackLink): BackLink {
  const { query } = useLocation();
  const [kind, id] = (query.from ?? '').split(':');
  const target = useLiveQuery(async (): Promise<BackLink | null> => {
    if (kind === 'menu' && id) {
      const menu = await getMenu(id);
      return menu ? { href: paths.menu(menu.id), label: menu.name } : null;
    }
    if (kind === 'dish' && id) {
      const dish = (await getDishDetails(id))?.dish;
      return dish ? { href: paths.dish(dish.id), label: dish.name } : null;
    }
    return null;
  }, [query.from]);
  return target ?? fallback;
}

/**
 * Read by default, edit on request (FEEL_PASS 2, UX principle 1). A page is
 * in edit mode while its URL has `?edit=1`, so the phone's Back leaves edit
 * mode instead of the page.
 *
 * - start(): Edit (top right). Adds `edit=1` as a new history entry.
 * - done(): Done (top right). Goes back to the entry Edit came from when
 *   there is one, else replaces the URL without `edit`, so Back from the
 *   reading view never lands in edit mode again.
 */

import { useLocation } from 'preact-iso';

/** The reading URL Edit was tapped on, so Done can go back to it. */
let enteredFrom: string | null = null;

function urlWith(edit: boolean): string {
  const params = new URLSearchParams(location.search);
  if (edit) params.set('edit', '1');
  else params.delete('edit');
  const query = params.toString();
  return location.pathname + (query ? `?${query}` : '');
}

export function useEditMode() {
  const { query, route } = useLocation();
  const editing = query.edit === '1';
  return {
    editing,
    start() {
      enteredFrom = urlWith(false);
      route(urlWith(true));
    },
    done() {
      const reading = urlWith(false);
      if (enteredFrom === reading) {
        enteredFrom = null;
        history.back();
      } else {
        route(reading, true);
      }
    },
  };
}

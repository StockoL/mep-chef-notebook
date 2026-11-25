import { useState } from 'preact/hooks';
import { getPlaceDetails } from '../../data/kitchens';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { MenuSheet } from './MenuSheet';
import { WhereSheet } from './WhereSheet';

/**
 * Always at the top (UX → Navigation): where you are (tap for "Where are you
 * today?"), search (opens the library's search) and the menu.
 */
export function TopBar() {
  const details = useLiveQuery(() => getPlaceDetails());
  const [whereOpen, setWhereOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header class="top-bar">
      <button class="top-bar__place" type="button" onClick={() => setWhereOpen(true)}>
        <span class="top-bar__kitchen">
          {details?.kitchen?.name ?? 'No kitchen'} <Icon name="chevron-down" size="s" />
        </span>
        <span class="top-bar__section">{details?.section?.name ?? 'No section'}</span>
      </button>

      <div class="top-bar__actions">
        <a class="top-bar__action" href={paths.librarySearch} aria-label="Search">
          <Icon name="search" />
        </a>
        <button class="top-bar__action" type="button" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          <Icon name="more" />
        </button>
      </div>

      <WhereSheet open={whereOpen} onClose={() => setWhereOpen(false)} />
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

import { useState } from 'preact/hooks';
import { getPlaceDetails } from '../../data/kitchens';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { MenuSheet } from './MenuSheet';
import { WhereSheet } from './WhereSheet';

/**
 * Always at the top (UX → Navigation): where you are (tap for "Where are you
 * today?") and the menu. Search arrives with the library in Phase 2.
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
        <button class="top-bar__action" type="button" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          <Icon name="more" />
        </button>
      </div>

      <WhereSheet open={whereOpen} onClose={() => setWhereOpen(false)} />
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

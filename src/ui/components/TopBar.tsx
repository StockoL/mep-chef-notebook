import { Icon } from '../icons';

/**
 * Always at the top: where you are (kitchen and section), search, and the
 * app menu. Phase 1 makes the kitchen button open "Where are you today?";
 * until then every button here is a placeholder that does nothing.
 */
export function TopBar() {
  return (
    <header class="top-bar">
      <button class="top-bar__place" type="button">
        <span class="top-bar__kitchen">
          No kitchen <Icon name="chevron-down" size="s" />
        </span>
        <span class="top-bar__section">No section</span>
      </button>

      <div class="top-bar__actions">
        <button class="top-bar__action" type="button" aria-label="Search">
          <Icon name="search" />
        </button>
        <button class="top-bar__action" type="button" aria-label="Menu">
          <Icon name="more" />
        </button>
      </div>
    </header>
  );
}

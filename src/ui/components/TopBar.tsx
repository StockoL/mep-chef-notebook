import { useEffect, useRef, useState } from 'preact/hooks';
import { getPlaceDetails } from '../../data/kitchens';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { MenuSheet } from './MenuSheet';

/**
 * Always at the top (UX → Navigation): the kitchen you're in, search (opens
 * the library's search) and the menu (where you also switch kitchen).
 */
export function TopBar() {
  const details = useLiveQuery(() => getPlaceDetails());
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);

  // Publish the bar's height as --top-bar-height, so things that stick while
  // scrolling (chef's sheet photo) stick just below it, whatever the text size.
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty('--top-bar-height', `${element.offsetHeight}px`),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <header class="top-bar" ref={header}>
      <p class="top-bar__place">
        <span class="top-bar__kitchen">{details?.kitchen?.name ?? 'No kitchen'}</span>
      </p>

      <div class="top-bar__actions">
        <a class="top-bar__action" href={paths.librarySearch} aria-label="Search">
          <Icon name="search" />
        </a>
        <button class="top-bar__action" type="button" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          <Icon name="more" />
        </button>
      </div>

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

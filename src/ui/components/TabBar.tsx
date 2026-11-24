import { useLocation } from 'preact-iso';
import { Icon } from '../icons';
import { isTabActive, tabs } from '../router';

/**
 * The four bottom tabs. They're ordinary links: preact-iso catches the click
 * and swaps the screen without reloading the page.
 * aria-current="page" marks the active tab for screen readers and for CSS.
 */
export function TabBar() {
  const { path } = useLocation();

  return (
    <nav class="tab-bar" aria-label="Main">
      {tabs.map((tab) => (
        <a
          key={tab.path}
          class="tab-bar__tab"
          href={tab.path}
          aria-current={isTabActive(tab, path) ? 'page' : undefined}
        >
          <Icon name={tab.icon} />
          <span class="tab-bar__label">{tab.label}</span>
        </a>
      ))}
    </nav>
  );
}

import { Icon } from '../icons';

interface ScreenHeaderProps {
  title: string;
  /** Where back goes, and its name: "‹ Settings" (UX → Navigation rule 3). */
  back?: { href: string; label: string };
}

/** The top of a screen pushed from a tab: a back link that names where it goes, then the title. */
export function ScreenHeader({ title, back }: ScreenHeaderProps) {
  return (
    <header class="screen-header">
      {back && (
        <a class="screen-header__back" href={back.href}>
          <Icon name="chevron-left" />
          {back.label}
        </a>
      )}
      <h1>{title}</h1>
    </header>
  );
}

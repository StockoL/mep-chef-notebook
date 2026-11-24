import type { JSX } from 'preact';

/**
 * Mep's icons: 24 px grid, stroked, round caps (docs/DESIGN.md → Icons).
 * Each entry is the inside of one SVG. Add an icon by adding an entry here.
 */
const ICONS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  book: (
    <>
      <path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z" />
      <path d="M5 20a1 1 0 0 0 1 1h13v-3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  bin: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  'chevron-left': <path d="m15 5-7 7 7 7" />,
  'chevron-right': <path d="m9 5 7 7-7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  tick: <path d="m5 12.5 4.5 4.5L19 7" />,
} satisfies Record<string, JSX.Element>;

/**
 * The union of every key above: 'home' | 'book' | 'clock' | …
 * TypeScript works it out from the object, so <Icon name="hom" /> is a
 * type error, and adding an icon needs no second list.
 */
export type IconName = keyof typeof ICONS;

/**
 * The sprite sheet: every icon as a <symbol>, rendered once at the top of
 * the app and hidden. <Icon> points at a symbol instead of repeating paths.
 */
export function IconSheet() {
  return (
    <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
      {Object.entries(ICONS).map(([name, shape]) => (
        <symbol key={name} id={`icon-${name}`} viewBox="0 0 24 24">
          {shape}
        </symbol>
      ))}
    </svg>
  );
}

interface IconProps {
  name: IconName;
  /** LooseLeaf's .icon sizes: s = 0.75em, l = 1.5em, default 1em. */
  size?: 's' | 'l';
}

/** An icon from the sheet. Always decorative: put the words on the button. */
export function Icon({ name, size }: IconProps) {
  return (
    <svg class="icon" data-size={size} aria-hidden="true" focusable="false">
      <use href={`#icon-${name}`} />
    </svg>
  );
}

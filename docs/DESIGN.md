# Design: tokens, CSS and UI code

How Mep looks and how its interface code is organised. UX.md says what the screens do; this file says how they're built. The wireframes on the design canvas show the intended look.

## Look

Warm, quiet and Apple-like: warm stone neutrals, one burnt-orange action colour, white cards on a sunken background, large type for anything read at arm's length. Colour carries meaning, never decoration: orange means "you can act on this", amber means "over time or not confirmed", red means "can't be undone or unsafe".

## Tokens

The theme is made with the LooseLeaf configurator and lives in `design/`:

- `design/design-tokens.json`: the configurator file. Edit it there (or in the configurator) and re-export; never hand-edit the CSS.
- `design/looseleaf-tokens.css`: the compiled custom properties. Phase 0 copies it to `src/styles/looseleaf-tokens.css`, loaded after `looseleaf.css`.
- `design/preview.html`: a quick visual check of colours and the type scale at phone width.

The current values were built with LooseLeaf 2.5.1's own `build-tokens` and pass all 20 of its contrast pairs (WCAG AA) in light and dark.

### Choices and why

| Token | Value | Why |
| --- | --- | --- |
| Fluid range | 360–1024 px | Phones to iPad portrait. LooseLeaf's default (to 1240) is for websites; Mep never runs that wide |
| Body text | 1rem: 17 px at the iPhone's default text size, rising to about 19 px on an iPad, and following the phone's Text Size setting | iOS's own body size, and the chef's own choice of size (see below) |
| Type ratio | 1.2 → 1.25 | A steeper ratio made the page title 64 px on a phone; this gives 35 px |
| Headings | h1 = step 4, h2 = 3, h3 = 2, h4 = 1 | Shifted down one step to suit app screens, not web pages |
| Smallest sizes | step −1 (≈14 px) for meta lines; step −2 (≈12 px) only for tab-bar labels | Anything smaller is unreadable mid-shift |
| Display sizes | `--display-timer` (72–96 px at default size, capped at 24% of screen width so a large text setting can't push it off screen), `--display-task` (step 3), `--display-quantity` (step 1) | Arm's-length reading in prep mode and on the sheet |
| Spacing | 3xs–l as LooseLeaf; xl/2xl/3xl back to 3×/4×/6× | The earlier 5.15×/7×/7.6× jumped from 32 px to 82 px; a phone screen has no room for that |
| Region space | space l (32 px) | Was xl; page sections on a phone need far less |
| Tap target | `--tap: 48px`, fixed, not fluid | A finger doesn't get bigger on an iPad |
| Neutral | hue 60, chroma 0.008 | Warm stone, close to the wireframes' #F5F5F4 |
| Action | hue 42, chroma 0.17 → #B84400 | Burnt orange; 5.4:1 with white text |
| Danger | hue 25 | Was the same hue as action, so a delete would look like an ordinary button. Now clearly red |
| Warning | hue 80 | Amber for overruns and "not confirmed", well away from action orange |
| Accent | hue 185 (teal), chroma 0.11 | Kept for passive and check-in jobs in the plan, so they read apart from active work |
| Fonts | system font stack (SF on iPhone, Roboto on Android) | No download, works offline from the first open, feels native. Inter isn't needed |
| Numbers | `font-variant-numeric: tabular-nums` on timers, quantities and counts | Digits don't jump as a countdown ticks |
| Line height | body 1.4 | 1.5 is for reading prose; lists of jobs want tighter rows |
| Radii | controls 12 px, cards 18 px, chips pill | Matches the wireframes |
| Links | no underline until hover | Rows and cards are links; underlining them all is noise. Links inside prose keep an underline via `.prose` |
| Motion | quick 150, base 250, slow 400 ms; scroll reveal off | An app should feel quick; content fading in as you scroll gets in the way at work |

## Text size and dark mode

Text size follows the phone; the app has no size setting of its own (DECISIONS 26). Don't fight Apple.

```css
/* The root size comes from the phone. Every rem-based token scales with it. */
html { font-size: 106.25%; }                 /* 17 px where the browser's default is 16 px */
@supports (font: -apple-system-body) {
  html { font: -apple-system-body; }        /* iPhone/iPad: follows Settings → Display & Brightness → Text Size */
}
body { font-family: var(--font-body); line-height: var(--leading-body); }  /* re-set after the font shorthand */
```

- The tokens are built with a 16 px base so that `1rem` is body text: 17 px at the iPhone's default, larger or smaller with the phone's setting. On Android the browser's own text size setting applies the same way.
- Every size, space and display size is in rem, so the whole layout scales together. Tap targets stay at a fixed 48 px minimum but grow with their text.
- Layouts must survive the largest accessibility sizes: rows wrap instead of truncating, quantities drop below the name when there's no room, the tab bar keeps icons and hides labels if they'd collide. Phase 1 tests this at the largest setting.
- Phase 1 also checks whether a change to the phone's setting shows up straight away or only after the app reopens.
- App settings shows a line saying where to change it ("Text size follows your phone") rather than a control.

Dark mode uses LooseLeaf's `theme.js` (`data-theme` on `<html>`, applied before first paint). Default: follow the phone, with a manual override in settings. Kitchens are bright, so it's mainly for home.

## CSS structure

CUBE, in LooseLeaf's layer order: global → compositions → blocks → motion → utilities.

```
src/styles/
  main.css               imports in order: looseleaf.css, looseleaf-tokens.css, blocks/*, exceptions
  looseleaf-tokens.css   copied from design/
  blocks/                one file per Mep block, each in @layer blocks
    tab-bar.css  capture-bar.css  sheet.css  segmented.css  chip.css
    list-row.css  stepper.css  numpad.css  timer.css  switch.css  top-bar.css
```

Rules:

1. Use LooseLeaf compositions (`.flow`, `.cluster`, `.sidebar`, `.switcher`, `.reel`, `.center`) for layout before writing layout CSS.
2. Use LooseLeaf blocks where they fit (button, card, badge, field, input, progress, toast, modal). Write a Mep block only where LooseLeaf has none.
3. Blocks use semantic tokens only (`--color-*`, `--space-*`, `--radius-*`, `--display-*`), never raw ramp values or hex.
4. Variants are data attributes (`data-state="done"`, `data-mode="passive"`), as LooseLeaf does, not extra class names.
5. Each Mep block has one CSS file and one Preact component with the same name.
6. Respect `--motion-scale` and the phone's reduce-motion setting: every duration is `calc(var(--duration-*) * var(--motion-scale))`.

## JavaScript and LooseLeaf

- Load `looseleaf.css` and the blocking `theme.js`. Don't load `looseleaf.js`: its behaviours add roles, tab order and listeners to existing HTML, and Preact expects to own the DOM it renders. Two things editing the same elements causes bugs that are hard to trace.
- Write the behaviours Mep needs as Preact components using LooseLeaf's class names and markup: tabs and segmented controls, toasts (the undo bar), menus. LooseLeaf's behaviour scripts are the reference for keyboard and ARIA details.
- Sheets use the native `<dialog>` element (top layer, focus trapping and Escape for free), styled as a bottom sheet.

## UI code

```
src/ui/
  app.tsx           shell: top bar, router outlet, capture bar, tab bar
  router.ts         preact-iso routes; each tab remembers its last route
  components/       one per block: TabBar, CaptureBar, Sheet, Segmented, Chip, ListRow, Stepper, NumPad, Timer, Switch, UndoBar, EmptyState
  screens/          Today, Inbox, Library/*, Component, Dish, Ingredient, Plan, PrepMode, Section/*, Settings/*
  icons.tsx         one inline SVG <symbol> sheet, used with LooseLeaf's .icon
  hooks/            useLiveQuery (Dexie liveQuery as a hook), usePromise
```

- Routing: `preact-iso` (small, from the Preact team). Path routes; the service worker serves the app shell for any path when offline.
- State: everything lasting (current kitchen and section, settings) is stored data, read with `useLiveQuery`, so a screen updates whenever stored data changes. Component-local UI state uses `useState`. Preact Signals can come later if shared in-memory state is needed; Phase 1 didn't need it.
- Gestures: UX.md's drag-to-reorder and swipe-to-sort/delete are buttons in a sheet for now (Phase 1); they work one-handed and with wet fingers. Gestures can be added on top later.
- Screens read data through `src/data/` only, never Dexie directly.

## Motion, sound and haptics

- Motion comes from LooseLeaf's motion layer: press (buttons shrink slightly while pressed), the done checkmark drawing itself, sheets sliding in with `@starting-style`.
- Mep-specific motion: ticked sheet items settle to the bottom; prep mode's "done" card lifts away and the next slides up; scaled numbers change in place. All under the motion switches.
- Haptics: Safari on iPhone doesn't support the vibration API, so the app can't buzz on iPhone. Use `navigator.vibrate` only where it exists (Android), never as the only feedback. On iPhone the feedback is visual, plus LooseLeaf's opt-in sounds (off by default; useful in prep mode for the countdown passing zero).

## Icons

Stroke icons, 24 px grid, 1.8 px stroke (2 px when active), round caps, drawn to match the wireframes: home, book, clock, list, camera, mic, bin, search, more, chevrons, tick. One `<symbol>` sheet; no icon library.

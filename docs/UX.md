# UX

The person using this is mid-shift: wet hands, one hand free at most, glancing at a phone propped on a shelf, being called to the pass. Design for that, then make it pleasant at home.

## Rules

1. During a shift, fewest taps wins. State the tap count for every common path.
2. Defaults over settings. The app remembers the last kitchen, last screen and last scaling choice.
3. No confirmation dialogs except for things that can't be undone. Prefer undo.
4. Saving is automatic. There is no "save" button for notes or edits.
5. Tap targets at least 48×48 px; primary actions sit in the bottom half of the screen within thumb reach.
6. High contrast, large type for anything read at arm's length (timers, current task, quantities).
7. Recipe setup can ask for more, but never twice, and never for something the app can work out.
8. Never block on missing data. A draft is always allowed; it just isn't scheduled.
9. Offline is normal, not an error state. Don't show connection warnings for core features.

## Key screens

### Today (home)

Opens on today's shift sheet, never on something half-finished: the day, then today's sheet first (covers, progress, tick-off rows, + Add). Below it, quietly: the next service, "needs you" items only when something does (notes to sort, backup due, near the end of the shift "write the next shift's sheet"), the weekly goal as one line, and other days' sheets. Later: a slim "next" bar (next job, Start).
A capture bar sits above the tab bar on every main screen: tap it and a sheet slides up with the keyboard ready; photo and voice are one tap each from the bar. Waste is logged from the Section tab (DECISIONS 48).
Common path for a note: tap the bar → type → done.

### Component

Header: name, type, tags; variation chips underneath (house first); status of the variation in use (draft or ready, with "what's missing").
Scale control at the top (yield or anchor ingredient).
Lines, then steps with chips. Editing is inline.

### Dish

Plating photo and spec, components (each opens its recipe), allergens gathered from all of them, the menus it's on, and "add to today's sheet". Scales by portions.

### Ingredient

Everything that uses it (dishes and components), techniques applied to it, ideas that mention it, then products, prices and allergens.

### Plan

Today's sheet in time order, split into blocks around service windows: passive and check-in jobs as bars, active jobs in order, free time shaded, "needs cover" flags, drafts listed alongside as manual to-dos. Start opens prep mode.

### Prep mode

For working through the sheet in the hours before service, not for service itself. During service the chef is cooking from tickets and the app stays out of the way.

One current task, large; countdown (into negative); one big "done" button. Next two tasks shown smaller. Running passive jobs as a strip. "X min behind" when late. Nothing editable.

## Navigation

Four tabs, plus three things that are always there. A navigation map is on the design canvas.

- Always there: the top bar (the kitchen's name, search, and ••• for everything else, including switching kitchen), the capture bar on every main screen. The app doesn't ask which section you're on (DECISIONS 48).
- Today: today's sheet, the next job, "needs you". Opens add-to-sheet, prep mode, tomorrow's sheet and the inbox.
- Library: a cookbook with four ways in, behind one segmented control, plus one search box and + to add:
    - Dishes: by menu and course; switch menu (on now, coming up, past) at the top. A dish opens its components; a component opens its recipe.
    - Components: grouped by type (the kitchen's own list), expandable in place; each says which dishes use it. Filters: my section, drafts, tags, collections.
    - Ingredients: A–Z; each opens its ingredient page.
    - Techniques: grouped by category. Filled = has your notes; outlined = name only.
    - Search matches names and aliases of all four, plus your notes, with results grouped by kind.
- Plan: today's sheet in time order around services; Start opens prep mode.
- Section: the chef's station admin: stock count and draft order, items and pars, checklists, waste log, tomorrow's sheet, weekly report.

Rules:

1. Every name is a link: a dish opens its components, a component its recipe, an ingredient its page, a technique word its technique sheet. Components also open from today's sheet, search and any "used in" list.
2. Tabs are roots: tapping the current tab returns to its top; each tab remembers where you were in it.
3. Drilling in pushes a screen with a back button that names where it goes ("Library", "Menu"). Back always returns to the same scroll position.
4. Quick tasks (add to sheet, edit a service, a technique from a recipe) open as sheets over the current screen and close with a swipe down.
5. Full-screen modes (prep mode, stock count) are entered deliberately and left with one clear Exit or Finish.
6. No dead ends: every screen has a way back or forward, and nothing is more than three taps from a tab.

"No kitchen" sits at the top of the kitchen list in ••• → Kitchen.

## Kitchen settings

Reached from ••• → Kitchens → a kitchen. One screen per kitchen:

- the kitchen's name (tap to rename);
- its sections: add, drag to reorder, swipe to rename, set as usual or hide;
- services and shift, equipment (used by the scheduler), suppliers (used by draft orders) and house rules (shelf life, labels);
- all kitchens: add a new one, switch, or archive one you've left (its notes and recipes are kept).

## First run

On iPhone in Safari (not yet installed), first run opens with "Add to your home screen": a short illustrated step (Share → Add to Home Screen) and why it matters (your notebook is kept safe and works offline). It can be skipped but returns as a "needs you" item until installed.

Then one screen, skippable: "Where do you work?" (name a kitchen, or no kitchen). The app then asks for persistent storage and shows one line about backups. It lands on an empty Today with a hint pointing at the capture bar.

## App settings

Reached from the top bar menu: export and import, backup reminder (and when the last backup was), the step reader's word list, editable lists, a note that text size follows the phone, dark mode (follow the phone, or always light/dark), and an "About your data" line saying the phone holds the only copy.

## Editable lists

Every list the chef sees (sections, services, menu types, courses, component types, technique categories, waste reasons, tags, the sheet's name) uses the same editor: drag to reorder, tap to rename, swipe to hide, "merge into…" to combine, + to add. Kitchen lists are edited in kitchen settings; the chef's own lists in app settings. Nothing shows "Larder" unless the kitchen calls it that.

## Inbox

A list of captured items, newest first, each with its kitchen, section and time. Swipe right to sort (component, dish, technique, kitchen note, new draft), swipe left to delete with undo. Reached from "needs you" on Today.

## Empty states and undo

Every list explains what goes in it and offers the one action that fills it. Deleting anything shows an undo bar for a few seconds instead of a confirmation.

## Editing and setup

The same rules everywhere a chef adds or changes something:

1. Edit in place, in sheets that slide up over the screen you came from, not new pages. "Done" closes; there's no Save button.
2. Everything saves as you go, and new components save as drafts from the first keystroke, so being called away loses nothing.
3. Type it your way. Shorthand ("bones 2kg, mirepoix 500g") is read into tidy rows underneath as you type; correct a row by tapping it.
4. Defaults first. Type, tags, units and quantities start from the most likely value (the last one used, the par, a component's batch size).
5. Choices as chips and segmented controls, times and numbers as large tappable values with a picker. No dropdowns.
6. Quick-quantity buttons wherever a quantity is set: top up to par, one batch, or other.
7. Picking several things collects them in a tray at the bottom; one tap adds them all.
8. Anything the app works out itself (used in, allergens, suggested tags, batch size) is shown, not asked for.

Visual design, tokens and motion are in docs/DESIGN.md.

Wireframes for these flows (edit a service, add a component, add to today's sheet, section item, add a technique) are on the design canvas, second row.

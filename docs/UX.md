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

## Principles (the feel pass, 26 Nov 2026)

1. Read by default, edit on request. Pages open in a reading view. Editing is one tap away (Edit, top right) and never the first thing you see, except for something just created or a recipe with nothing written yet.
2. One orange thing per screen. The filled action colour is for the single main action on a screen. Chosen chips and segments are black, not orange.
3. Quiet structure. One large title per page. Sections get small labels, not headings. Content is the loudest thing on the screen.
4. Teach once. Helper text shows until the chef has used that field (or seen that screen) once, then goes.
5. Chrome earns its place. Bars stay only on screens where they're used.
6. Say what isn't known. Missing data reads as "not known yet", never as a reassuring answer.

## Reading and editing

- Recipes (components), dishes, menus and techniques open to read. Edit (top right) switches the page into edit mode in place, with `?edit=1` in the address, so the phone's Back leaves edit mode; Done (top right) returns to reading (DECISIONS 55).
- The reading view has no text boxes, unit pickers or helper text. A missing piece (a step with no time, nothing written yet) is a link that opens edit mode.
- Something just created opens in edit mode. So does a recipe with no ingredients and no method.
- Settings, kitchen settings and the ingredient page are setup screens and stay as forms.

## Key screens

### Today (home)

The shift, not a checklist. From the top: the date and kitchen (small), the day (title); the next service ("Lunch from 12:00 · in 1h 20", tap to change today's times); one "Needs you" line only when something does (notes to sort, backup due, service times not set, this week's goal, last week's check-in, the next shift's sheet near the end of a shift, add to Home Screen), which opens the list; this week's goal as one quiet line; the next job from the plan with Start; today's sheet (progress, tick-off rows, + Add as the one orange button, From chef's sheet); other days' sheets.
The capture bar sits above the tab bar on Today, Plan, Section and the inbox: tap it and a sheet slides up with the keyboard ready; photo and voice are one tap each from the bar. It tucks away while scrolling down (DECISIONS 56). Waste is logged from the Section tab (DECISIONS 48).
Common path for a note: tap the bar → type → done.

### Component

Reading: name; type, dishes and tags as one small line; whose recipe it is and its status ("House recipe · Dumbleton Hall · Draft: step 3: no time", the missing item a link into edit mode); variation chips when there are two or more; one scale control ("Makes 1kg · as written", tap for the scaling sheet); ingredients as rows (name left, amount right); the method as numbered steps with their chips and technique links; "More about this recipe" folded at the bottom (made a batch, used in, notes and attempts, allergens, versions).
Edit: name, origin, another way, makes, the ingredients box and the method box, each with what Mep read straight underneath; type, tags, aliases, collections, delete.

### Dish

Reading: plating photo and spec, components (each opens its recipe, scaled to the dish's covers when set), allergens gathered from all of them, "add to today's sheet" (the one orange button), and the menus it's on as a small line of links with "Add to a menu": pick a menu on now or coming up, then its course (the courses that menu uses first). 3 taps, with Undo. Price and who makes what are set on the menu, in its edit mode.
Edit: name, kitchen, description, add a component, amounts/order/remove, how many, plating photo and spec, tags, collections, delete.

### Ingredient

Everything that uses it (dishes and components), techniques applied to it, ideas that mention it, then products, prices and allergens.

### Plan

Today's sheet in time order, split into blocks around service windows: passive and check-in jobs as bars, active jobs in order, free time shaded, "needs cover" flags, drafts listed alongside as manual to-dos. Start opens prep mode.

### Prep mode

For working through the sheet in the hours before service, not for service itself. During service the chef is cooking from tickets and the app stays out of the way.

One current task, large; countdown (into negative); one big "done" button. Next two tasks shown smaller. Running passive jobs as a strip. "X min behind" when late. Nothing editable.

## Navigation

Four tabs, plus three things that are always there. A navigation map is on the design canvas.

- Always there: the top bar (the kitchen's name, search, and ••• for everything else, including switching kitchen). The capture bar is on Today, Plan, Section and the inbox only (DECISIONS 56). The app doesn't ask which section you're on (DECISIONS 48).
- Today: today's sheet, the next job, "needs you". Opens add-to-sheet, prep mode, tomorrow's sheet and the inbox.
- Library: a cookbook with four ways in, behind one segmented control, plus one search box and + to add:
    - Dishes: by menu and course. The menu is a heading ("À la carte · on now ▾") that opens "Which menu?" (All menus first, then each menu on now and coming up, then all dishes); under the dishes, "Open À la carte" goes to the menu itself (allergen matrix, Edit). Menus are also in ••• → Menus; the library opens on a current menu served today (the one last looked at if it is, else the à la carte). Menus are labelled by when they're served ("Sundays · Lunch"; DECISIONS 57). Filters (where it's from, section, tags, collections) are behind one Filter button that shows how many are on. A dish opens its page; a component opens its recipe.
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

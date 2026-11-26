# Feel pass: brief

A pass over the whole app to make it calm to use on a shift. No new features. Written 26 Nov 2026 after a review of the build at phone size (390 × 844) with the Dumbleton seed loaded, and Louis's own first use.

## What's wrong, in one paragraph

Almost every screen is a form. The component and dish pages open as editors: text boxes, unit pickers and helper text, even when the chef only wants to read the recipe. On top of that, orange is used for everything (main buttons, links, selected filters, selected units), every section has a large heading, instructions stay on screen after the first use, and Today is a stack of setup prompts rather than a view of the shift. Each piece works; together they make the app feel busy and unfinished. The wireframes in `docs/wireframes/` show the intended calm: content first, small grey labels, black for selected, orange for the one thing to do.

## Rules for this pass

- No new features and no new tables. If a fix seems to need a schema change, stop and ask.
- Keep the data layer as it is; this is UI work in `src/ui/` and `src/styles/`. The one exception is item 1.
- One commit per item below, in this order. Tests pass after each.
- For each screen you change, take a before and after screenshot at 390 × 844 (headless Chrome, as for the e2e checks) and list them in the phase summary with the tap count for the common path.
- Read `docs/wireframes/README.md` first. Layout and flow come from the wireframes; colours and sizes from `design/` and `docs/DESIGN.md`. Where they disagree with this brief, this brief wins.

## Principles (add these to docs/UX.md)

1. Read by default, edit on request. Pages open in a reading view. Editing is one tap away (Edit, top right) and never the first thing you see, except for something just created.
2. One orange thing per screen. The filled action colour is for the single main action on a screen. Everything else is neutral.
3. Quiet structure. One large title per page. Sections get small labels, not headings. Content is the loudest thing on the screen.
4. Teach once. Helper text shows until the chef has used the thing, then goes.
5. Chrome earns its place. Bars stay only on screens where they're used.
6. Say what isn't known. Missing data reads as "not known yet", never as a reassuring answer.

## Work items

### 1. Allergens must not read as "none" when nothing is recorded (bug, do first)

Now: a dish or component with no ingredient lines shows a green "Every line confirmed." and "None in its ingredients as recorded." `AllergenSummaryView` in `src/ui/components/FoodSafety.tsx` treats zero lines as complete, so the summary is vacuously true. This breaks the "never guess" principle in SPEC.

Do:
- In `src/data/allergens.ts` (or wherever `complete` is worked out), complete is false when there are no lines at all, anywhere in the component tree. Add a flag such as `empty` so the UI can say why.
- When empty, show in a neutral (not green) style: "Allergens not known yet: no ingredients recorded."
- Green "Every line confirmed" only when there is at least one line and every line is confirmed.
- Add tests: empty component, empty dish, a dish whose components are all empty, a dish with one empty component and one complete one (must be incomplete).

Done when: no empty dish or component anywhere in the seed shows a confirmed or "none" message.

### 2. Split reading from editing

This is the core of the pass.

Component page (`src/ui/screens/LibraryPages.tsx`):
- Reading view, in this order, as in `docs/wireframes/Component.html`:
  - Name.
  - Variation chips (house first).
  - One small status line: "House · Dumbleton Hall · Draft: step 3 needs a time". The missing items are links that open edit mode at that field.
  - A compact scale control. "Make…" and "From what I've got" become one control that shows the current scale, e.g. "Makes 2 l · × 1"; tapping it opens the scaling sheet.
  - Ingredient lines as rows: name left, amount right, tabular digits, prep note muted.
  - Method as numbered steps with their chips and technique links.
  - "More about this recipe" stays folded at the bottom.
- No text boxes, unit pickers or helper text in the reading view.
- Edit (top right) switches the page into edit mode in place, with `?edit=1` in the URL so Back leaves edit mode. Done (top right) returns to reading.
- Edit mode keeps what's there now: Makes and unit, the ingredients box, the method box, templates.
- In edit mode, the ingredients box and the method box each show their parsed result directly underneath. Don't also show a second list of the same lines further down the page. Today the page shows the shorthand box and then the same ingredients again as a parsed list; in reading view only the parsed rows show, and in edit view only the box with a light live preview.
- A newly created component opens straight in edit mode. So does any component with no lines and no method, with a one-line prompt instead of an empty reading view.
- "Made a batch: label it" moves into the More section or the page's ··· menu; it's not a reading action.

Dish page:
- Reading view, in this order:
  - Plating photo (large, if there is one).
  - Plating spec as text.
  - Components as rows; each opens its recipe, scaled to the dish's portions if set.
  - Allergens summary.
  - One action: "Add to today's sheet" (this is the page's orange button).
  - The menus it's on, as a small line.
- Edit mode has "Add a component", "Amounts, order, remove", the plating spec box, the photo picker, how-many and the kitchen.
- Today the page has two filled orange buttons (Add a component, Add to today's sheet). After this pass it has one.

Menu page (`src/ui/screens/Menus.tsx`):
- Tapping a dish opens the dish page. Today it opens the admin sheet (course, price, target GP, who makes what), which is setup, not reading.
- The admin sheet opens from the menu's Edit mode: in Edit mode, tapping a dish opens it.
- "Delete menu" and "Copy for a new season" move into "Menu details" or Edit mode. A red delete button must not sit at the bottom of an everyday screen.
- "0 of 52 components ready" stays as one small line under the title.

Anywhere else a page opens as a form (technique page, ingredient page, kitchen pages), apply the same rule if the chef mostly reads it. Settings and kitchen settings are setup screens and stay as forms.

Done when: opening a component, a dish and a menu dish shows no input fields until Edit is tapped, and the wireframe order is followed.

### 3. Colour discipline

Now: `--color-action` is used for primary buttons, text links, back links, selected chips (`.chip[aria-pressed='true']` in `src/styles/blocks/chip.css`), selected segmented options, selected yield units and prompts like "Set your service times".

Do:
- Selected chips, segmented controls and unit pickers: neutral selected state, i.e. `--color-text` fill with `--color-text-inverse` text, as in the wireframes. Unselected: surface with a border.
- At most one filled action-colour button per screen. Others use the default outlined `.button` or a plain text button.
- Links inside text and back links may stay action-coloured (they're small). Prompts like "Set your service times" become rows in the "Needs you" list (item 5), not orange text.
- Status colours (success, warning, danger) only for status, never decoration.
- Grep every `--color-action` and `data-variant` use and check each against these rules; list exceptions in the phase summary.

### 4. Quiet structure: headings, labels, helper text

- One `h1` per page. Today's title is the day ("Thursday"), with "26 November · Dumbleton Hall" as a small line above it. No two-line dates.
- Section headings inside pages ("Today's sheet", "Components", "Allergens", "Plating", "Changeover", "On now", "Your lists") become small section labels: semibold, uppercase, muted, `--text-small`, as in the wireframes. Add one `.section-label` style in `src/styles/blocks/` and use it everywhere. Keep the real heading elements (h2) for screen readers; change only their look.
- Helper text such as "One step per line, in your own shorthand…" or "One per line or separated by commas. Saved as you go.":
  - Show it only until the field has content, or until the chef has used that kind of field once. Use a small "seen" set in settings, keyed by hint name.
  - Write hints in one short line.
- Empty states keep their one line of explanation and one action. Remove the dashed borders: an empty state is quiet text, not a box.

### 5. Today: the shift, not a checklist

Rebuild `src/ui/screens/Today.tsx` around the shift, following `docs/wireframes/Today.html`. From the top:
1. Small line: date and kitchen. Title: the day.
2. One line for the next service: "Lunch from 12:00 · in 1 h 20 · 48 covers". If no services are set, this line is the prompt "Set service times" (a row, not orange text).
3. "Needs you": one line, only when something does, e.g. "Needs you: 4 notes to sort · backup due". Tapping it opens a small list: notes to sort, backup due, service times not set, weekly goal not set, install to Home Screen (after the first dismissal of the install sheet). Each row says what to do and goes there. The backup card, the goal prompt and the service-times link move into this list.
4. The weekly goal, if set, as one quiet line ("This week: …").
5. Next job card from the plan, with Start, when there's a plan.
6. Today's sheet: progress, items, ticked items settling to the bottom. "+ Add" is the screen's one orange button. "From chef's sheet" is a secondary button next to it.
7. At the very bottom, small: "Other days' sheets".

Done when: with a fresh kitchen, Today shows the day, one "Needs you" line and an empty sheet with Add, and nothing else above the fold.

### 6. Library

- Open on the Dishes lens, showing the menu on now that was last viewed. If none has been viewed, show the first on-now menu whose type is à la carte, else the first on-now menu. Today it opens on Breakfast.
- Replace the three rows of pills with:
  - The lens control (Dishes / Components / Ingredients / Techniques) as one segmented control.
  - For Dishes, the menu as a single tappable heading ("À la carte ▾") that opens a menu picker sheet.
  - Section and other filters behind one "Filter" button that shows a count when filters are active.
- Search placeholder: "Search". The current long placeholder is cut off at phone width.
- Each list row: name, then one muted line. Drop "Draft · in 1 dish" repetition where every row says the same thing. Show "Draft" only on the Components lens, as a small marker.

### 7. Chrome

- The capture bar shows on Today, Plan, Section and Inbox. Hide it in Library pages, Settings, kitchen settings and any edit mode. On screens where it shows, it slides away when scrolling down and returns when scrolling up or stopping. Respect reduced motion: no slide, just show and hide.
- This changes UX.md's "capture bar on every main screen": record it as a decision (next number in DECISIONS.md) with the reason: it took about a fifth of the screen with the top bar and tab bar, on screens where nothing is captured.
- The top bar stays.

### 8. Small fixes

- App settings → Backup reminder: the Daily / Every 3 days / Weekly control wraps and breaks its border at phone width. Use a segmented control that fits, or a row that opens a picker.
- App settings → Storage: "Test marker" and "Write test marker" are developer tools. Move them behind a "Developer" row at the bottom, collapsed, or remove them now that the persistence test is done.
- Menus list: the "New menu: …" field sits inline on an everyday screen. Make it "+ New menu", which opens a sheet.
- Check every screen for text truncated mid-word at 390 px and at the largest iPhone text size (DECISIONS 26).
- Motion: check that ticking a sheet item, opening and closing sheets, and switching between reading and editing use the LooseLeaf motion layer, and that nothing jumps. List anything that does.

### 9. Seed data (needs Louis)

`loadSeed` turns every word in each dish's component list into a component, so the Library shows 129 untyped drafts, including plain ingredients ("Apple", "Almond", "Basil"). This is the seed's shape, not the app's, but it makes browsing feel like noise.

Do:
- Propose a split of `seed/dumbleton-hall.json`: for each dish, which entries are components (things the kitchen makes: "romesco sauce", "pickled beetroot") and which are ingredients (bought or raw: "apple", "basil"), and a guessed component type for each component.
- Write it as a separate proposal file (`seed/proposed-split.json`) for Louis to correct after a few shifts. Don't change `loadSeed` or the seed until he has.

## Out of scope

New features, scheduler changes, schema changes, sharing and sync, a new visual identity. The tokens in `design/` stay as they are.

## When it's done

- Walk through these flows at 390 × 844 and report tap counts and before/after screenshots:
  - open the app → see the next job
  - add an item to today's sheet
  - find the Burrata on the à la carte and read its recipe
  - edit a component's method
  - log waste
- Update `docs/UX.md` (the six principles, reading and editing, chrome) and `docs/DESIGN.md` (colour rules, section labels).
- Add decisions for reading/editing and the capture bar.
- Add a changelog entry and a LEARNING.md entry.
- Stop, and list anything from this brief that was left out and why.

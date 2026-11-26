# Changelog

One entry per phase.

## Phase 0: Scaffold (24 Nov 2026)

An installable, offline, empty app with the foundations in place.

- Vite 8, Preact 11, strict TypeScript; deployed to GitHub Pages at `/mep-chef-notebook/` on every push to `main`, after the tests pass.
- LooseLeaf-UI 2.5.1 CSS and inlined `theme.js`; Mep's tokens loaded into the `global` layer; text size follows the phone.
- App shell: top bar (kitchen placeholder), four tab routes (Today, Library, Plan, Section) with `preact-iso`, capture bar (placeholder), icon sheet. Deep links work on Pages and offline.
- `src/core` stubs with tests: allergens (the 14), step parser shape, units, scaling factor, `Scheduler` interface; `formatMinutes`.
- Dexie database with the whole v1 schema (41 tables), automatic ids and timestamps, and the built-in "No kitchen" record (`id: "none"`).
- Export to `.zip` (`data.json` + `media/`) and import with validation; tested by round trip. Format in `docs/EXPORT_FORMAT.md`.
- PWA: manifest, service worker (precaches the app, 11 files), icons and iOS splash screens generated from `public/favicon.svg`. Updates take over only just after opening or while the app is in the background, and never touch stored data.
- Persistent storage requested on every start and the result recorded; iPhone "Add to Home Screen" card on Today.
- Temporary "Phase 0 check" on the Section tab: install state, storage, test marker, export, import.
- Optional HTTPS for phone testing with mkcert (`.cert/`).

## Phase 1: Capture and kitchens (24 Nov 2026)

Replaces the paper notebook for quick notes.

- First run: name a kitchen or choose no kitchen, then a usual section (or add your own); both skippable.
- Capture bar on every main screen: a note (saved from the first keystroke, 2 taps), a photo (shrunk to 2000 px JPEG, DECISIONS 33), a voice note, or waste. All tagged with kitchen, section and time.
- Inbox, newest first: sort a capture into a kitchen note or a new draft component (house variation in a kitchen, the chef's own with no kitchen), or delete with Undo.
- Kitchens: create, switch from the top bar ("Where are you today?"), archive; "No kitchen" built in. The app reopens in the last kitchen and section; switching section takes 2 taps.
- Editable lists: one editor for sections, services and the chef's lists (waste reasons, component types, technique categories): rename, reorder, hide, merge (moves every reference), add.
- Kitchen settings: name, sections with a usual one, services with times by day (DECISIONS 32), the chef's usual shift, kitchen notes; empty screens for equipment, suppliers and house rules.
- Today: the date, the next service you work (on now / next / set your times), the weekly goal line, and "needs you" (notes to sort, backup due, last week's check-in).
- App settings: back up now and the reminder (daily, every 3 days, weekly), import, dark mode, the chef's lists, storage and the test marker. Replaces the Phase 0 check panel.
- Waste log and weekly goal (with check-in and history) under the Section tab.
- Schema v2: services hold time windows, kitchens a usual section, sections and services can be merged. Existing data upgrades in place and old exports upgrade on import (`src/data/migrations.ts`), both tested.
- Layout survives the largest accessibility text size (simulated at 310%): headings capped to the screen width, rows and bars wrap, tab labels hide behind their icons.

### Phase 1 follow-up: feedback and editing (25 Nov 2026)

From the first test on the phone: it wasn't clear whether things had saved, whether a voice note was recording, or where a sorted note went.

- Every automatic save shows "Saving… / ✓ Saved" in the screen or sheet header (`trackSave`, `SaveIndicator`); saving stays automatic (UX rule 4). Edit screens (service times, services and shift) end with "Changes save as you go" and a Done button. Time fields save as the wheel turns.
- The voice sheet shows it's recording: a pulsing red dot, a running stopwatch (0:07) and a level bar that moves with your voice. The audio context is unlocked inside the tap, so the meter works on iPhone.
- Messages say where things went, with View (and Undo where it can be undone): note, photo and voice note → inbox; sorted → kitchen notes or Library; waste → waste log.
- Kitchen notes have their own screen (••• → Kitchen notes, and from kitchen settings): edit, move back to the inbox, delete with Undo.
- Notes can be edited before sorting; a component in the Library shows the notes sorted into it; waste entries can be corrected or deleted.
- Switching kitchen or section, adding a kitchen or list item, and the goal check-in each confirm with a short message.

## Phase 2: Library (25 Nov 2026)

Components and dishes are easier to find in the app than in the notebook.

- Library tab: one search box (names, aliases, descriptions and notes, grouped by kind), Recent, and four lenses: dishes, components grouped by type, ingredients A–Z, and techniques (empty until Phase 7). Tag and collection filters. "+ New" makes a component, dish or ingredient. The top bar's search opens it.
- Components: name, type, tags, aliases, collections; one variation to start (house in a kitchen, your own with no kitchen), base yield, "used in" dishes and components, its notes. Delete with Undo (refused while another component uses it).
- Ingredients in shorthand ("bones 2kg, mirepoix, tom puree 1 tbsp"), read into rows as you type, each saying whether it's a known ingredient, another component, or new. Unknown ingredients are created on save; half-typed ones are tidied away.
- Method as plain steps, one per line (read by the step parser in Phase 4).
- Dishes: description, plating photo and spec, components (add, reorder, remove with Undo; add a new draft component from the picker), tags, collections.
- Ingredients: name, aliases, basic or bought-in, the 14 allergens (data only), and everything that uses it, through components (the jus uses the stock that uses the bones).
- Units gain kitchen count words: tsp, tbsp, pinch, bunch, sprig, clove, slice, sheet, leaf, tin, pack (DECISIONS 34).
- Every text box saves after a pause, when you leave it, when the app goes to the background, and when the screen closes (`useAutosave`).
- Layout checked at the largest text size again: rows, chips, buttons and segmented controls wrap.

## Phase 3: Shift sheet (25 Nov 2026)

Run a real shift from the app's sheet.

- Today's sheet on the Today tab: progress ("3 of 8 done"), a big tick per item (ticked items settle to the bottom, with Undo), draft markers, covers, and each item's amount ("2l" or "top up to 500ml") and service. Tap an item to change it, open its recipe, or take it off.
- Adding: type it as you'd write it ("beurre blanc 2l": matched to your components and section list), or tap items on your section list into a tray and add them all at once (a par becomes "top up to par").
- Chef's paper sheet: photograph it (kept with the sheet, DECISIONS 35), then type each line with the photo pinned below the top bar.
- Write the next shift's sheet: on the next day you have a shift, with unfinished items carried over (once). Offered in "needs you" from 90 minutes before your shift ends. Other days' sheets are under ••• → Sheets.
- Share a sheet as text (WhatsApp, Messages), grouped by service; where sharing isn't available it's copied, or shown to copy by hand.
- Section list (Section tab): what your section looks after, with pars and where it's kept.
- Covering two sections: "Also covering" in Where are you today?; both share one sheet, and the top bar shows "Fish + Starters" (DECISIONS 37).
- Events (kitchen settings → Events): weddings and functions with covers, notes and their own service times, replacing a usual service or alongside. A one-off time change takes 2 taps from Today: tap the next-service line, change the time.
- Schema v3: sheets keep a photo; older data and exports upgrade. "Today" rolls over at midnight (DECISIONS 36).

## Phase 4: Step parser (25 Nov 2026)

Write steps your way; the app reads the scheduling data from them.

- The step reader (`src/core/parser/`): times ("40-45 min", "1h30", "2½ hrs", "min 2 hrs", "overnight"), settings ("220c", "160 fan", gas marks and °F converted to °C, "low"), equipment from verbs and equipment words, the three modes with overrides ("turning", "by hand", short check-ins become active), several steps on one line, times that run on ("roast 15 more", "then 5-10"), "while hot", "to order", "the day before", "then as brown stock", @component references, "skim every hour", holds and critical points (cooling, hot holding; 63°C in a water bath isn't hot holding).
- `npm run parser:score`: 58 of 58 test-set lines fully correct (100%). The rules were written against these lines, so expect real-world misses; new lines in `parseStep.test.ts` check the rules beyond the set.
- The method on a component page: each step shows its readings as chips, empty chips for what's missing ("+ time"). Tap a chip to correct kind, time, equipment, setting or timing; "Looks right" confirms a step, "Confirm all" the rest. "Edit method" goes back to the text box.
- Corrections teach the word list ("From now on, “blend” reads as Mixer", with Undo). Settings → Step reader's words lists them, to forget one. Exported with everything else.
- Draft or ready is worked out from the steps (DECISIONS 39), with "what's missing" (one tap each to fix) and a message when an edit drops a recipe back to draft.
- Kitchen settings → Equipment is now an editable list; "Bench" added to every kitchen's list once.
- Schema v4: steps hold parts (DECISIONS 38). Old steps are read at start-up; older exports upgrade on import.

### Phase 4 follow-up: amounts without numbers (25 Nov 2026)

From entering a beer batter recipe on the phone.

- Ingredient lines read a unit written without a number as one: "turmeric pinch", "pinch of salt", "a handful of parsley", "half pint lager".
- New units (DECISIONS 34): pint (shown as pints, measured as 568 ml), dash, splash, handful, knob, smidgen, glug, dollop. Estimates for these when scaling are planned for Phase 5 (DECISIONS 41).

## Phase 5: Scaling and units (25 Nov 2026)

Scale without arithmetic under pressure.

- Component pages open with **Make…** (scale to an amount: "3 l", "40 portions") and **From what I've got** (pick an ingredient, say how much you have: "340 g butter"). While scaled, a blue banner says so ("Scaled ×1.5 · makes 3l"), the ingredients show at the new amounts beside what they were, and **As written** goes back. The choice is remembered per component; the recipe never changes.
- Amounts round to what can be measured (DECISIONS 42): 342 g → 340 g, 1234 ml → 1.23 l, 1.4 tsp → 1½ tsp.
- Rough measures get an estimate when scaled (DECISIONS 41): "6 pinches ≈ ¾ tsp". A component used in the recipe links to itself scaled to the amount needed.
- Units convert inside scaling: g/kg, ml/l, pints; across weight and volume with an ingredient's density; and counts by your own weights.
- Ingredient pages have **Weights**: what 1 ml weighs, and what one of each count it's written with weighs ("1 handful = 40 g", "one egg = 55 g").
- Dishes: set each component's amount per portion (Amounts, order, remove), then **How many?** shows each component for that many covers or people, each opening the component scaled to it.
- On the sheet, "Open the recipe for 2l" opens it scaled to the sheet's amount.
- Schema v5: ingredients hold the chef's weights; older data and exports upgrade.

### Phase 5 follow-up: by hand, and where a recipe is from (25 Nov 2026)

From entering a beer batter learned at Ellenborough Park.

- Step reader: "in a bowl", "hand whisk" and "by hand" read as active work on the Bench; equipment on the kitchen's own list is read from step text; "on the day before service" no longer means the day before.
- Correcting a step: add any equipment from the sheet ("Other: mixing bowl"), saved to the kitchen's list. Setting and timing sit under "Setting and timing" unless one is set.
- Tap the line under a recipe's name ("House recipe · Dumbleton Hall · Draft") to say where it's from: a kitchen's house recipe (add a kitchen you've worked in; it's kept as one you've left), your own, a book or another chef, or an idea (DECISIONS 44).

## Phase 6: Menus, variations and versions (25 Nov 2026)

One component, several ways of making it; menus by course; changeover.

- Variations: chips under a component's name (the one in use here first, ✓). **+ Another way**: a copy as my own (the original is untouched), from a book or another chef, or an idea. Ideas have the idea itself and "I suggested it to chef today" with chef's response. **Compare** shows two side by side, differences highlighted. **Delete this way** with Undo (never the last).
- Versions: each editing session keeps a version (DECISIONS 45). **History** lists them with what changed ("Flour 300g → 350g · method changed") and a note; tap one to see it as it was and **Restore** (with Undo).
- **Log an attempt**: dated notes on a component, shown under Notes and attempts.
- Menus (Library → Dishes → Menus…, or Kitchen settings → Menus): name, type, status, dates; dishes by course with price, target GP% and which section makes each component; "Only dishes my section touches"; "12 of 30 components ready". **Copy for a new season** (coming up), **Launch this menu** (the old one moves to past). Menus of kitchens you've left are reached from their kitchen settings.
- Library → Dishes opens on the menu on now, by course; chips switch menu or show all dishes.
- Dish page: the menus it's on, allergens gathered from its components, **Add to today's sheet** (with amounts when covers are set), tag suggestions from its menus and courses (components too).
- Section list: everything the menus on now give your section, alongside what you've added (DECISIONS 47); the sheet's add tray includes them.
- The undo bar's buttons wrap at large text sizes.

### Phase 6 follow-up: a quieter app (25 Nov 2026)

From using it: too much on the home screen, cluttered chips, and "Where are you today?" was friction.

- The app no longer asks which section you're on (DECISIONS 48). The top bar shows the kitchen's name, search and •••; switch kitchen from ••• → Kitchen. First run is one screen. "Also covering" is gone.
- Today's sheet is the kitchen's sheet for the day. In + Add, chips choose any section's list (the last one used opens first). The Section list works the same way.
- Menus: "Only dishes my section touches" became section chips (All sections, Fish, Veg…).
- Today: the sheet comes first; next service, needs-you, goal and other days' sheets sit underneath. "Write the next shift's sheet" appears once the sheet has something on it.
- Waste left the capture bar (now note, photo, voice); Section tab → Log waste.
- Recent, the Library's lenses, tag, collection, menu and section chips sit on one row that scrolls sideways.

## Phase 7: Techniques and method templates (25 Nov 2026)

Your own technique notes, linked from every step; methods from templates.

- Techniques (Library → Techniques, by category; filled chips have your notes): name, aliases, category, how you do it, common mistakes, ways by context ("textured mixes"), photos and video, a note for the kitchen you're in, method templates, notes from the inbox, and where it's used. 46 names and aliases ship built in; the notes are yours.
- In a method, technique words are underlined: tap one and the technique opens over the recipe (this kitchen's note first); Done puts you back where you were. Words inside ingredient names ("tom puree") aren't linked.
- Method → **Use a template**: 11 built-in methods (brown, white and fish stock, braise, reduction sauce, beurre blanc, pickle, purée, pasta dough, shortcrust, confit), the one matching the recipe's name first. Its steps are read with every chip filled, so **Confirm all** makes the recipe ready. **Save this method as a template** for any technique.
- "A word here is a technique" in a step's correction sheet; Inbox → **A technique's notes**; ingredient pages list **Techniques applied** (from prep notes and steps).
- Step reader: "rub in" and "bring together" (active, bench); a step naming the last word of an ingredient ("roast bones" → chicken bones) links to that line for scaling.
- Search finds techniques. Videos play in place.

## Phase 8: Prep scheduler v1 (25 Nov 2026)

The Plan tab: today's sheet in time order, worked back from your services.

- The scheduler (`src/core/scheduler/`, behind `scheduler.plan(input)`): the longest chains start first, your hands are never on two things at once, check-ins and left-alone steps run alongside, equipment doesn't clash at different settings, a recipe waits for the stock it needs, things held warm aren't made too early, and anything late is flagged (DECISIONS 50).
- Plan tab: blocks around your services ("Before Lunch, ready by 12:00", "Lunch 12:00–14:30"…), each step with its time, what it is (hands on, keep an eye, left) and equipment; free time shaded; "needs cover: cooling" when something that can't be left has to run during service; past steps fade, the one on now is outlined. Tick a job and it's ticked on the sheet.
- Beside the plan: drafts and things with no recipe, as to-dos. Done items under Done.
- Tomorrow's sheet: overnight cures and sets are planned today ("For tomorrow: started before you go"); today's items skip what was started yesterday.
- The plan starts at the start of your shift; without service times or a shift, it says what's missing.

## Phase 9: Prep mode, live timers, learned durations (25 Nov 2026)

Follow the plan with a glance; the plan learns your times.

- Plan → **Start prep**: the current task large, with a countdown that carries on into negative time and one big button. Start, then **Done**: done starts the next hands-on task. "Done, but I was interrupted" keeps that time out of learning. The next two tasks show smaller; things left to cook (in the oven, simmering) are **Started** and run in a strip with their own countdowns.
- "6 min behind" when late; the unstarted tasks are re-ordered only if a job would otherwise miss its time ("Re-ordered so … can still be ready in time"). During service: no countdown, order kept.
- Progress is kept (schema v6): close the app and prep mode picks up where it was. The plan marks steps "✓ Done in 12 min" and "Running now"; a job's last step done ticks it on the sheet.
- Learned times (DECISIONS 51): after three timings of a step, the plan uses your time ("your time (3 timings)"): the median, recent ones counting more, scaled by batch size. Your hands-on times come with you to any kitchen; oven and hob times stay with the kitchen. Recipes keep their written times.
- The screen stays on in prep mode (where the phone allows it).

## Phase 10: Food safety (25 Nov 2026)

Answer the pass correctly; label what you make.

- Allergens on every component and dish, worked out through every component it uses, each with where it comes from ("Mustard from Mayonnaise (via Rémoulade)"); may-contain kept apart. "Not complete" until every ingredient is confirmed, never read as allergen-free.
- Ingredients: allergen chips with the legal sub-types (which cereal, which tree nut). Bought-in ingredients have **Products here**: brand, supplier, pack, price, contains and may contain from the label, a photo of it and when it was checked. A recipe uses this kitchen's only product automatically; with more, "Which mayonnaise?" is one tap from the allergens. Changing a product's allergens says which recipes it re-checked.
- Kitchen settings → **House rules**: shelf lives by component type or for one component ("3 days"), and targets for cooling, hot holding and reheating (the legal limit is shown as a reminder).
- **Made**: on a sheet item or a recipe, records a batch and shows a day-dot label: name, made, **use by** (its day large), allergens and your initials. No rule, no use-by. Section → **Batches and labels** lists them.
- Cooling, hot holding and reheating steps show the kitchen's target in the method, the plan and prep mode. The step reader now flags reheating.

## Phase 11: Section admin (25 Nov 2026)

Run a section's numbers from the same book.

- **Costs**: a recipe shows what a batch costs and per 100 g/ml or per portion, worked out from product prices through every component it uses; ingredients can have a yield loss. A dish shows its cost per portion and GP on each menu against its target; menus show GP on each dish. GP is from the price without VAT (DECISIONS 53). What isn't priced is listed. Changing a price says which dishes it pushes below target.
- **Count** (Section): one item at a time with a big number pad, Next and Finish; then what's below par, the stock value, and links to the draft orders.
- **Draft orders**: ingredients below par, rounded up to whole packs, by supplier, with an estimated cost; share as text. Mep never places an order.
- Writing the next shift's sheet tops up components below par.
- **Opening and closing checks** per section: tick each day; edit the list (schema v7: `checklistRuns`).
- "Also used for …" on sheet items and recipes when a component or ingredient is on other dishes on now, with a heads-up on tomorrow's sheet or a reminder.
- **Allergen matrix** per menu (grid, print or PDF, spreadsheet), headed as a working copy.
- **Weekly report**: goal, stock value, waste by reason and item with costs, GP against target, items often short; print or save as PDF. Goal suggestions on the weekly goal, par suggestions on the section list, waste costed in the waste log.

## After Phase 11: less on each page (26 Nov 2026)

From first real use: too much on one page.

- **Section → Money**: GP on each menu on now (below target flagged), prices still to add for what's on the menus, recipe costs, and this week's stock value and waste. Costs and GP are no longer on recipe, dish and menu pages, the waste log or the count.
- The Section tab is in two groups: **On shift** and **Admin**.
- Recipe pages open on yield, ingredients and method; dish pages on where it's from, components, add to sheet and allergens. Everything else is under **More about this recipe/dish** (it stays open once opened, for the session). A recipe with one way of making it no longer shows a chip for it.
- Dishes have a kitchen (schema v8), shown under the name and changeable there; older dishes take theirs from their menus or recipes.
- Library: filter dishes and components by where they're from (each kitchen, Mine, All). Search results say where each is from, so two dishes called "Steak" can be told apart.
- Names like "Cornish sea bass (Dumbleton, 2026)": the library offers to tidy them once, recording the kitchen instead, with undo.

## Feel pass (26 Nov 2026)

Calm to use on a shift. No new features (docs/FEEL_PASS.md).

- Allergens are never "none" when nothing is recorded: "Allergens not known yet: no ingredients recorded", and a dish with one empty component isn't complete.
- Read by default, edit on request: recipes, dishes, menus and techniques open to read, with Edit and Done at the top right (DECISIONS 55). Recipes read like the wireframe: one scale line, ingredients with amounts on the right, numbered steps with quiet chips. The method box shows its readings directly underneath.
- One orange thing per screen; chosen chips, segments and ticks are black.
- Quiet structure: one title per page, small section labels, helper text that shows until you've used the field once, empty states as plain text.
- Today shows the shift: the day, the next service, one "Needs you" line, the next job with Start, and the sheet.
- Library: opens on the menu last looked at; lenses as one control; the menu as a heading with a picker; filters behind one Filter button; Recent while searching; "Draft" as a small marker.
- The capture bar only shows where things get captured, and tucks away while scrolling down (DECISIONS 56).
- Small fixes: the backup reminder and appearance controls fit at phone width; the storage test marker is under Developer; a new menu is made in a sheet.
- `seed/proposed-split.json`: a proposed split of the seed into components and ingredients, for Louis to correct.
- Dishes: the menus a dish is on are links, and "Add to a menu" puts it on one from the dish page (menu, then course; 3 taps, with Undo).
- Menus are easy to find again: ••• → Menus (with what's on now), "All menus" at the top of the Library's menu picker, and "Open À la carte" under a menu's dishes.

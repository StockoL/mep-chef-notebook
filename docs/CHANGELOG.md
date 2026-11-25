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

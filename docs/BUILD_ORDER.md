# Build order

Phases are built in order, and several can follow one another in a session. Each phase ends usable: Louis tests it on his phone, on a real shift where he can, and the next phase can start straight away; anything found in use goes into the next phase's work. Getting the app into use quickly matters most (DECISIONS 31).

Pure logic (`src/core/`) is built and tested before the UI that uses it. Names follow SPEC → The building blocks: dish, component, ingredient, technique, kitchen.

---

## Phase 0: Scaffold

Goal: an installable, offline, empty app with the foundations in place.

- Vite + TypeScript + Preact project (DECISIONS 13–14)
- PWA manifest (`short_name` "Mep", `name` "Mep: chef's notebook and prep planner", DECISIONS 22) and service worker; installs on Android and iOS; loads in airplane mode
- LooseLeaf-UI installed from npm: `looseleaf.css` and `theme.js` only (DECISIONS 23); `design/looseleaf-tokens.css` copied to `src/styles/` and loaded after it; system fonts (docs/DESIGN.md)
- `src/styles/` and `src/ui/` laid out as in docs/DESIGN.md; first blocks: top bar, tab bar, capture bar, icon sheet; base layout: top bar (kitchen switcher placeholder), main area, bottom tabs (Today, Library, Plan, Section) with a capture bar above them (docs/UX.md, Navigation)
- Dexie database with the whole v1 schema from SPEC → Data model, including tables whose screens come later (DECISIONS 20)
- iPhone install: detect Safari-not-installed and show the "Add to Home Screen" step (docs/UX.md, First run); icons and splash screens for iOS and Android
- Updates: a new service worker version installs without touching IndexedDB; test an update over existing data
- Storage: call `navigator.storage.persist()` on first run and record the result; test on an iPhone that the installed app keeps its data after a few days unused
- Export/import skeleton: export an empty database to `.zip`, import it back
- Vitest running with one passing test per `src/core/` stub
- `.gitignore`, README commands updated, `docs/CHANGELOG.md` started

Done when: installs from the dev server onto a phone, opens offline, an empty export round-trips, tests pass, and the persistence result is noted in the log.

## Phase 1: Capture and kitchens

Goal: replace the paper notebook for quick notes.

- First run: name a kitchen or choose "no kitchen", optionally pick a usual section; skippable (docs/UX.md)
- Today screen and the capture bar; capture text, photo and voice note, saved instantly, tagged with kitchen, section and time
- Inbox list, newest first; sort an item into a kitchen note or a new draft component, or delete (dishes, techniques arrive later)
- Editable lists: the shared rename / reorder / merge / hide behaviour, used by sections, services and waste reasons from here on (DECISIONS 16)
- Kitchen settings: rename, sections (add, reorder, rename, usual, hide), usual services and shift, links to equipment, suppliers and house rules (empty screens until their phase)
- Kitchens: create, switch from the top bar, archive; "no kitchen"; app reopens where it was
- Today shows the next service you're on (K5)
- App settings: export, import, backup reminder, dark mode; text size follows the phone (DECISIONS 26), tested at the largest accessibility size
- Waste log from capture: item, quantity, reason; no costs yet (A4)
- Weekly goal: one line, shown quietly on Today, end-of-week check-in, history (G1)

Done when: a text note takes 2 taps from opening the app; photos survive export → import.

## Phase 2: Library

Goal: components and dishes in the app are easier to find than in the notebook.

- Components: name, type, tags, aliases; one variation to start (house for the current kitchen, or mine); base yield + unit
- Lines in shorthand ("bones 2kg"); quantity and unit read as you type; new ingredients created as you go
- Lines can point at another component
- Steps as plain text, one per line (no parsing yet); every variation is a draft
- Dishes: name, description, plating photo and spec, components
- Ingredients: basic ingredients with allergens (data only); the ingredient page lists every dish and component that uses it
- Library tab with the four lenses (Dishes, Components, Ingredients, Techniques as an empty lens) and one search box
- Tags suggested from what's typed and where things are used; collections

Done when: 10 real components and 3 dishes entered on a phone, each found again in under 3 taps; looking up an ingredient lists everything that uses it.

## Phase 3: Shift sheet

Goal: run a real shift from the app's sheet.

- Section item lists (components and ingredients) per section
- Switch section from the top bar; cover two sections with one sheet (MS3)
- Events: one-off services and time changes with their own times and covers (K6)
- Today's sheet: items with quantity or top-up target, optional service, tick to settle; draft items marked
- Enter a sheet from a photo (photo pinned while typing) or from the section list
- Write tomorrow's sheet at end of shift (unfinished items carried over); share as text (SH1–SH3)

Done when: a real shift run from the app's sheet, and the next shift's sheet written in under 3 minutes.

## Phase 4: Step parser

Goal: read kitchen shorthand into step data.

- `src/core/parser/`: tokeniser, word lists (verbs → mode/equipment), duration/temperature/unit parsing (gas mark and °F), multi-step splitting, flags
- `npm run parser:score` runs every case in `tests/fixtures/step-parser-test-set.json` and prints a score and the misses
- Chip UI under each step: readings shown as chips, tap to correct, empty chips for missing fields
- Personal word list: corrections saved and applied next time; exported with data
- Draft → ready computed per variation from step completeness, with "what's missing" text

Done when: the parser scores at least 80% of fixture cases fully correct (report the number), and status logic matches SPEC → Draft or ready.

## Phase 5: Scaling and units

- `src/core/units/` and `src/core/scaling/`: convert, scale by yield, by portions/headcount, by anchor ingredient; sensible rounding
- Components scale by yield or anchor; dishes by portions
- Scaled view never overwrites the stored variation
- Rough amounts (pinch, dash, splash, glug, dollop, smidgen) show a ≈ spoon or ml estimate when scaled (DECISIONS 41); an ingredient can hold the chef's own weight for a knob or handful

Done when: scaling tests cover all three methods and rounding; anchor scaling works in 2 taps from a component.

## Phase 6: Menus, variations and versions

- Variations: house per kitchen (default), mine, book/chef, ideas; chips under the title, swap and side-by-side compare; "suggested to chef" on ideas (V1–V5)
- Every save creates a version; history; restore; attempt notes
- Menus: type, status, dates; dishes by course with price and target GP%; which section makes each component; menu view filterable to "mine" (MS1, MS2)
- Changeover: copy current menu, coming-up menus with readiness, past menus kept; section item lists built from menus on now plus standing items (MS4)
- Tag suggestions from menus and courses

## Phase 7: Techniques and method templates

- Technique entries: name, aliases, category, notes, variants, photos/video, kitchen notes; built-in names and aliases
- Auto-linking in steps and prep notes via the parser; tap to open, back to return; automatic "used in"
- Ingredient page gains "techniques applied" from steps and prep notes
- Sort an inbox note into a technique; add an unknown technique word from a step chip
- Method templates for common techniques (stocks, braises, sauces, pickles, purées, doughs), with typical steps and times; apply, then edit; save your own

Done when: tapping a technique word opens its entry in one tap and back returns to the same place; a shorthand ingredient list plus a template gives a ready variation with only corrections needed.

## Phase 8: Prep scheduler v1

- `src/core/scheduler/` behind `Scheduler.plan(input) → Plan`; greedy baseline from SPEC
- Respects modes, dependencies, equipment clashes, holds, multi-day prep
- Several ready-by times in one shift (lunch, dinner, event service times)
- Blocks around service windows; pausable jobs preferred inside windows (a cost, not a hard rule); others placed there flagged "needs cover" with the reason (PS5)
- Plan tab: today's sheet in time order; drafts as manual to-dos beside it
- Unit tests with hand-checked plans

Done when: a real afternoon's sheet produces a plan Louis would follow.

## Phase 9: Prep mode, live timers, learned durations

- Prep mode: current task large, countdown into negative time, one "done" tap starts the next
- Re-sequence unstarted tasks only when a ready-by time or equipment slot is affected; otherwise "X min behind"
- Inside a service window: order kept, countdown dropped
- Record timings (service-window timings kept apart); median with recency weighting; "interrupted" tap; chef-owned active times, kitchen-owned equipment times
- Screen wake lock while prep mode is open

## Phase 10: Food safety

- Allergens through components, per variation, with where each comes from
- Products for bought-in ingredients: supplier, brand, contains / may contain, label photo, date checked; "not confirmed"; re-check on product change (FS5)
- Shelf life as kitchen house rules; "made" creates a batch and shows a day-dot label
- Critical points marked on steps with the kitchen's targets

## Phase 11: Section admin

- Product prices; yield loss; cost per batch and portion through components; GP% per menu dish; warnings
- Pars on section items; stock count screen; below-par list and stock value
- Tomorrow's sheet pre-filled from the count against pars and long-hold items
- Draft orders by supplier with cut-offs
- Waste costs; waste feeds GP, par suggestions and over-prep notes
- Goal suggestions from patterns
- "Also used elsewhere" note, with at most a prompt to tell someone (A9); test with the overlaps in `seed/dumbleton-hall.json`
- Allergen matrix export with sources and "working copy" marking
- Opening/closing checklists
- Weekly section report (PDF)

Done when: a real count of one section takes under 5 minutes and produces a draft order; a dish's GP updates when a price changes; the weekly report generates from a week of real use.

## Phase 12: Sharing and sync

- Share a component or dish via the share sheet, link or QR code; import one
- Reminder in the share flow to share only what's yours
- First optional sync option (decide first)

## Later

Home batch-cooking (multi-meal planning, freezer labels), label printing, OCR/AI import of old notebook pages.

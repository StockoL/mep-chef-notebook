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

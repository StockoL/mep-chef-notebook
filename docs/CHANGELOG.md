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

# Decisions

## Settled

| # | Decision | Why |
| --- | --- | --- |
| 1 | Local-first PWA; the chef owns their data; no central server or accounts | Chefs move between kitchens; kitchen signal is poor; data shouldn't depend on a service |
| 2 | Open, documented export/import, available from the first usable build | The device holds the only copy |
| 3 | Rules-based step parser at the core, not AI | Offline, consistent, explainable, testable |
| 4 | Three step modes: active, check-in, passive | Active/passive alone misplaces reductions, skimming, sweating |
| 5 | Each variation is draft or ready; drafts never go into the automatic plan | A plan must never be quietly wrong |
| 6 | Scheduling algorithm is swappable; greedy is a baseline only | Better approaches may exist; the step data is what's fixed |
| 7 | Active timings belong to the chef; passive timings belong to a kitchen's equipment | Knife speed travels, oven quirks don't |
| 8 | Kitchens are switchable profiles; "no kitchen" is valid; Home is a kitchen | Agency and relief chefs; home cooking |
| 9 | Replaced by 17 (purposes are now suggested tags) | |
| 10 | Fewest taps during a shift; setup may ask for more | Data quality at setup makes everything else work |
| 11 | Free and open source; optional donations; no chef subscription | Chefs already give enough to the job |
| 12 | UI built on LooseLeaf-UI, installed from its published npm package (name and version as in the looseleaf-ui repo's package.json) | Louis's own toolkit; the Django package doesn't apply to a client-only app |
| 13 | Stack: Vite + TypeScript (strict), Preact, Dexie.js over IndexedDB, vite-plugin-pwa (Workbox), Vitest | Local-first means all logic runs in the browser; types guard the parser and scheduler; Dexie gives versioned migrations; Preact handles live timers and re-sequencing; Vitest shares Vite's config |
| 14 | Export format: a single `.zip` with `data.json` + media files | Photos and voice notes don't belong inside JSON |
| 15 | Built from one chef's view: what they do, know and are responsible for; never tracks other chefs or the whole kitchen | A commis can't see the whole kitchen, and an app that pretends to would be wrong and intrusive |
| 16 | Every list is editable (rename, reorder, merge, hide, add); seeded values are defaults only. Fixed: the 14 allergens, units, the three step modes | Kitchens name things differently; the app mustn't dictate "Larder" to a kitchen that says "Starters" |
| 17 | Building blocks are dishes (anything served), components (a recipe for one part) and ingredients (basic or bought-in). Purposes are suggested tags, never fixed categories | "Recipe" meant two things; a starter can become a main |
| 18 | Status, kitchen and source live on the variation, not the component; shelf life lives only in kitchen house rules | One stock can be ready in one kitchen and a draft in another |
| 19 | The plan is the shift sheet in time order, not a second list | Two lists drift apart |
| 20 | Phase 0 creates the whole v1 schema, including tables whose screens come later | Real data arrives from Phase 1; breaking migrations on a chef's only copy are a risk |
| 21 | On iPhone it ships as a home-screen web app (Safari → Share → Add to Home Screen), not through the App Store. First run teaches the install step. An App Store wrapper (e.g. Capacitor) stays possible later from the same code | Own icon, full screen, offline and better storage protection without Apple review or a paid developer account; iPhone never prompts to install, so the app must show how |
| 22 | Name: **Mep**, with the descriptor "chef's notebook and prep planner". Manifest `name` "Mep: chef's notebook and prep planner", `short_name` "Mep" | How UK kitchens say MEP, as a word; no rank, so it still fits at CDP or sous; the descriptor makes it findable despite the political meaning |
| 23 | Load LooseLeaf's CSS and `theme.js`, not `looseleaf.js`; behaviours (tabs, toasts, menus) are Preact components using LooseLeaf's markup; sheets are native `<dialog>` | `looseleaf.js` edits existing HTML, and Preact expects to own what it renders; two owners means hard-to-trace bugs |
| 24 | Theme in `design/design-tokens.json` (LooseLeaf configurator): fluid 360–1024 px, 17 px body, system fonts, burnt-orange action, red danger kept apart from it. Details in docs/DESIGN.md | Phone-first, offline from the first open, arm's-length reading, colours that can't be confused |
| 25 | No reliance on haptics; vibration only where supported (Android) | Safari on iPhone has no vibration API |
| 26 | Text size follows the phone (`font: -apple-system-body` on iOS, the browser setting elsewhere); no in-app size control; layouts must work at the largest accessibility sizes | Don't fight Apple: the chef has already chosen a size for every app on their phone |
| 27 | Permanent address: GitHub Pages, public repo, at `/mep-chef-notebook/` (Vite `base`, used in dev too). Phone testing in dev uses mkcert for HTTPS | IndexedDB data belongs to the origin, so the install address must never change; service workers and `crypto.randomUUID()` need a secure context |
| 28 | Every row's id is a string UUID from `crypto.randomUUID()`, with `createdAt` and `updatedAt` | Import, sharing and any later sync never clash, unlike auto-numbered ids |
| 29 | Schema v1 adds two tables to SPEC's list: `media` (photo and voice Blobs, referenced by id) and `settings` (key/value: last kitchen and section, persist result, last backup, theme) | Blobs stay out of the data rows and map straight onto the export's `media/` folder |
| 30 | "No kitchen" is a real Kitchen record with id `"none"` (name "No kitchen", can't be deleted), created on first run. A `kitchenId` that means "where I am" is never null. `null` means only "not tied to any kitchen" (own, book and idea variations, techniques, ingredients) | IndexedDB can't index null, so compound indexes and "no kitchen" queries work; the two meanings stay apart |
| 31 | Ship first, learn later: the app is built for use on shift as soon as possible; learning the stack comes afterwards, from the phase log. Tests, versioned migrations and the export round trip stay, because they protect the chef's only copy | Louis needs the app now; the safeguards cost little and a lost notebook can't be undone |
| 32 | A service is one row (name, order, hidden, "I work this") holding a list of time windows, each for given days. SPEC's flat service fields became `windows` in schema v2 | Times differ by day (Sunday lunch runs later); renaming, hiding and reordering a service must act on one thing |
| 33 | Captured photos are saved as JPEG with the long edge at most 2000 px | Phone photos are 3–5 MB; the phone holds everything and every backup carries it |
| 34 | The fixed units are g, kg, ml, l, each, portion, plus kitchen count words: tsp, tbsp, pinch, bunch, sprig, clove, slice, sheet, leaf, tin, pack, dash, splash, handful, knob, smidgen, glug, dollop, and pint (shown as written, measured as 568 ml; added 25 Nov 2026). Metric and pints convert within weight or volume; count words never convert. cl and dl are read and stored as ml. A unit written without a number ("turmeric pinch", "half pint lager") is read as one (or a half) | Chefs write "thyme 3 sprigs"; forcing grams loses meaning, and a free-text unit can't be scaled |
| 35 | A sheet keeps the photo of chef's paper sheet it was entered from (`Sheet.photoId`, schema v3) | So the original can be checked later |
| 36 | "Today" for the sheet is the calendar date; it rolls over at midnight | Simple and predictable; a late finish can still open yesterday's sheet from the sheet list |
| 37 | Covering two sections: the usual section switch stays 2 taps, and "Also covering" in Where are you today? adds a second. Both share one sheet (`Sheet.sectionIds`) | MS3 without slowing the common switch |
| 38 | A written method line is one `Step`; the step reader stores the pieces of work it found in it as `Step.parts` (schema v4). The chef's text is never rewritten; the planner schedules parts | Splitting into separate lines would change the chef's text under them as they type |
| 39 | Draft or ready is worked out from the steps, never set by hand: every step confirmed, every part with a mode and a time, and check-in and passive parts with equipment. A part done to order needs no time; a part that is only a hold ("holds 3 days") needs nothing. No method = draft | A plan must never be quietly wrong (DECISIONS 5); service work isn't prep |
| 40 | A correction to a part's kind or equipment teaches the word list for that part's verb, at once, with Undo; time and setting corrections stay with the recipe. "Bench" joins the equipment list for work done by hand | Learning the word is P2; Undo covers one-off exceptions ("these nuts burn: check-in") |
| 41 | Rough amounts (pinch, smidgen, dash, splash, glug, dollop) are stored as written, never as numbers. From Phase 5, a scaled amount of one shows an estimate beside it, marked ≈, from a fixed table: smidgen ≈ 1/32 tsp, pinch ≈ 1/8 tsp, dash ≈ 1/8 tsp, splash ≈ 1 tsp, glug ≈ 2 tbsp, dollop ≈ 1 tbsp ("10 pinches (≈ 1 tsp)"). Knob and handful get no fixed estimate; an ingredient can carry the chef's own ("my handful of parsley = 40g"). Estimates are never used for costing or allergens | A pinch at normal size is how it's made; scaled ×10 it needs a measure. Handfuls vary too much by ingredient to share one figure |
| 42 | Scaled amounts round to what can be measured: weight and volume to 0.5 under 10, 1 under 100, 5 under 1000, then kg or l to 10 g/ml; pints to ¼; tsp to ¼, tbsp to ½; each to ½ under 5, else whole; portions whole; pinches, sprigs and other counts to ½ under 3, else whole. Nothing rounds away to nothing. Spoons and counts show as fractions (1½ tsp) | Kitchen scales weigh to the gram; nobody measures 0.37 of a sprig |
| 43 | The last scaling choice is remembered per component (and portions per dish) in settings, shown by a banner that can't be missed. While scaled, the scaled list replaces the ingredients editor; the recipe is only edited as written. Headcount is portions: a dish scales by "covers or people" through each component's amount per portion. The chef's own weights live on the ingredient (`Ingredient.unitWeights`, schema v5) | UX rule 2 without risking a scaled recipe being mistaken for the real one, or edited by accident |

## Open

- First sync option, if ever shared.
- Scheduler for one chef only at first, or a small section?
- App Store wrapper: only if the app is shared widely.

# Mep: Product Spec

This file is the canonical spec. Version 2 (24 Nov 2026): rewritten as one document after a consistency review; earlier drafts are in git history and in the claude.ai planning doc.

## The pitch

**Mep**: chef's notebook and prep planner. UK kitchens say "MEP" for mise en place; written as a word, it's the name. The icon and home screen say Mep; app stores, page titles and the manifest description add the descriptor so it can be found.

A personal kitchen notebook for working chefs. It captures notes as fast as paper, then turns them into scalable recipes, a shift sheet and a prep plan that tells you what to start first.

A commis's paper notebook fails in three ways:

- It's written in the order things happen, not the order you need them.
- It can't scale. Halving a beurre blanc or tripling a brine is mental arithmetic under pressure.
- It can't plan. It holds the recipes but not the order to make them in when you've got eight jobs and ninety minutes.

The app keeps the notebook's speed (scribble now, tidy later) and adds structure, scaling, variations and scheduling. It belongs to the chef, not the kitchen, so it moves with them between jobs.

## Principles

### One chef's view

The app sees the kitchen through one chef's eyes: what they do, what they know and what they're responsible for. It makes that chef as on top of things as possible. It never monitors other chefs, tracks the whole kitchen's stock or replaces the kitchen's own systems. Where something depends on other people, the app helps the chef notice it and say something; the conversation stays human. The app has one owner, so nothing is modelled "per chef".

### Fewest taps during a shift

During a shift (capture, looking things up, the sheet, prep mode) the design with fewer interactions wins: sensible defaults, one-tap actions for the common case, no confirmation dialogs unless something can't be undone, and the app remembers where you were. Setup (recipes, kitchens, menus) happens on a break or at home and may ask for more, as long as it never asks for anything twice or anything the app can work out.

### Nothing dictated

Kitchens differ, so every list the app uses can be renamed, reordered, merged, hidden or added to. The app starts with sensible defaults; the chef's words replace them. Only three things are fixed: the 14 UK allergens (with their legal sub-types), units of measure, and the three step modes. See Editable lists.

### Never guess

Where a wrong answer could matter, the app shows what it doesn't know instead of filling the gap: an unconfirmed product is "not confirmed", never allergen-free; a step with no time keeps its recipe out of the automatic plan; figures it estimates are labelled as estimates.

## What already exists

No existing app combines a personal chef's notebook with a prep scheduler.

| App | Built for | Take | Leave |
| --- | --- | --- | --- |
| [meez](https://getmeez.com/scaling) | Restaurant groups | Scale from any ingredient you're short of; unit conversion inside scaling; tags by station, creator, season | Team ownership of recipes, inventory, finance |
| [ChefNotes](https://apps.apple.com/de/app/chefnotes/id1598495858) | Individual pro chefs (iPhone, last updated 2022) | Versions and forks; private on-device storage; routines | iPhone-only |
| [Chef Tools](https://apps.apple.com/app/id6774072226) | Chefs and keen home cooks | Timers, allergen checks, photos, printable recipe sheets | Breadth without a scheduler |
| [MealTime](https://apps.apple.com/gb/app/mealtime/id1016295040) | Home cooks doing big meals | Working back from a finish time; timeline view | One cook, one oven, everything served at once |

The gap is a scheduler for professional prep: several components, shared equipment, long passive jobs and service windows.

## The building blocks

Five words, used the same way everywhere in the app and the code:

- A **dish** is anything that's served: a dish on a menu, a staff dinner, something cooked at home. It has a plating photo and spec and is made of components.
- A **component** is a recipe for one part: a stock, a sauce, a pickle, a garnish, a dough. A component can use other components (the jus uses the stock). Components are where methods, steps, scaling and variations live.
- An **ingredient** is something you don't make: a basic ingredient (celeriac, butter, eggs) or a bought-in product (a specific mayonnaise, stock base or bread).
- A **technique** is a way of doing something (julienne, quenelle, pickling), with the chef's own notes.
- A **kitchen** is a place the chef works, with its sections, services, menus, equipment, suppliers and house rules. "No kitchen" is valid.

A dish is linked to menus, not owned by one: the same dish can be on the à la carte and on an event menu, or on no menu at all.

## Kitchens

- A kitchen holds: its name; its sections; its usual services and the chef's usual shift; events; equipment (used by the scheduler); suppliers (used by draft orders); house rules (shelf life, labels); its menus; and its house variations of components.
- Switching kitchen and section is two taps from the top bar ("Where are you today?"). The app opens in the last kitchen and section used.
- "No kitchen" works everywhere on recipe defaults, so a one-day agency shift needs no setup. With no kitchen, the chef types a service time when planning.
- A kitchen the chef has left is archived; its notes, variations and menus stay searchable.
- Home is just another kitchen (home batch-cooking features are a later extra).

### Sections

- Sections are the kitchen's own names for its stations (seeded as starters and garnish, fish, meat, veg, pastry, breakfast; all editable).
- Each section has its item list (with pars), checklists and shift sheet.
- The chef has a usual section and can switch, or cover two at once (they share one sheet). Their own components, techniques, notes and timings always come with them.
- A component isn't tied to a section. The menu says which section makes which component for each dish, because the same rémoulade can be on starters one season and fish the next.

### Services and shifts

- A service is a window, not a moment: first tickets, last bookings and usual finish, by day of the week. (Dumbleton takes lunch bookings from 12:00 to 16:30 and dinner from 18:00 to 20:15.)
- The chef marks which services they usually work and their usual shift hours (10:00–22:30 at Dumbleton).
- Events change the pattern for a date: a wedding, function or party with its own name, covers, notes, one or more service times (canapés, wedding breakfast, evening food) and optionally its own menu. An event replaces a usual service or runs alongside it. A one-off time change ("dinner at 19:00 tonight") is a small event, two taps from Today.

## Menus and dishes

- A menu belongs to a kitchen: name, menu type (à la carte, Sunday lunch, breakfast, set, event; editable list), status (coming up, on now, past) and dates.
- A menu lists dishes by course (editable list), each with its price, target GP% and which section makes each of its components.
- The menu view shows every dish by course, filterable to "mine". Each dish shows the sections it touches and whether its components are ready.
- A dish page shows the plating spec, its components (each opens its recipe), allergens gathered from all of them, and a button to add components to today's sheet.
- Section item lists come from the menus on now plus standing items (stocks, staples), so a new menu updates what the chef counts and orders.

### Changeover

- New season: copy the current menu and edit it, start blank, or work from a photo of the printed menu.
- A coming-up menu shows how many of its components are ready, so new dishes can be learned and written up before launch.
- On launch the old menu moves to past. Nothing is deleted; a dish and a component show which menus they've been on.

## Components

### Variations and versions

Every kitchen has its own way of doing things, so a component holds several ways of making it rather than duplicates.

- Each variation has a source: a kitchen's house version, the chef's own, a book or another chef, or an idea.
- The current kitchen's house variation is the default and shown first; others sit as chips under the title. One tap swaps; any two can be compared side by side.
- An idea can be just a note, with where it came from and when, marked "suggested to chef" with their response, and turned into a full variation later. Nothing is ever suggested to anyone automatically.
- Each variation has its own status, lines, steps and versions. Every edit makes a version: history, restore, and dated attempt notes ("too much acid, cut vinegar 10%").
- The variation in use drives everything downstream: the sheet, the plan, scaling, costing and allergens. The recipe always shows whose version you're looking at.

### Draft or ready

A variation is a draft until every step has a mode, a time, and equipment for check-in and passive steps, all confirmed. Then it's ready (can be scheduled).

- A draft can go on the sheet as a plain to-do with a "draft" marker, placed by hand beside the plan, never in it.
- A draft shows exactly what's missing ("step 3: no time") with one tap to fix it.
- If an edit removes data from a ready variation, it drops back to draft and says why.
- A ready component that uses a draft component is flagged, and the draft part becomes a manual to-do.

### Scaling

Lines are stored against a base yield. Components scale by yield ("make 3 litres") or from an anchor ingredient ("I've got 340 g of butter left"); dishes scale by portions or headcount. Units convert inside scaling (density for volume↔weight) and amounts round to what can be weighed. Scaling never changes the stored recipe.

### Types and tags

- Each component has a type (seeded: stocks and jus, sauces and emulsions, pickles and cures, purées and veloutés, doughs and batters, garnishes and crisps, bases; editable). The library groups by it.
- Dishes and components have free tags. The app suggests tags from where things appear (the menu, the course, "staff dinner"), but suggestions are only suggestions: a starter can become a main. Tags replace the earlier idea of fixed "purposes".
- Chefs can make their own collections ("Christmas ideas", "things to master").

## Ingredients

- Basic ingredients have fixed allergens and need no brand.
- Bought-in ingredients point at a specific product per kitchen: supplier, brand, pack, "contains" and "may contain" (kept separate, at the detail a matrix needs: which cereal, which tree nut), a photo of the label or spec sheet, and the date checked.
- A house variation's lines point at the product that kitchen actually uses. A line using a bought-in ingredient with no product chosen shows "Not confirmed: which mayonnaise?"; allergens are only shown as complete when every line is confirmed. Changing a product re-checks every component that uses it.
- Each ingredient has its own page: every dish and component that uses it, the techniques applied to it in the book (from steps and prep notes: "celeriac, julienne"; "beets, pickled"), ideas that mention it, its products and prices, and its allergens. Looking up "carrot" shows every way it's been used, and therefore ways it could be used, all drawn from the chef's own book. No outside suggestions.
- Ingredient names have aliases ("tom puree" = tomato purée) so search and the step reader find them.

## Techniques

- First-class entries with a name, aliases, a category (seeded: knife work, shaping and plating, preserving, sauces, heat; editable), the chef's own notes and common mistakes, variants by context ("quenelle: smooth mixes / textured mixes"), photos or video, and a "used in" list built automatically.
- Kitchen-specific notes ("three-sided quenelles here") sit on top and show only in that kitchen.
- The app ships with technique names and aliases only, so linking works from day one; the content is the chef's own.
- The step reader recognises technique names in steps and prep notes and links them; one tap opens the technique as a sheet over the recipe, and back returns to the same place.
- A technique can carry a method template (brown stock the technique and brown stock the template are one entry).

## The library

One tab, a cookbook with four ways in, one search box and + to add:

- Dishes: by menu and course; switch menu at the top. A dish opens its components; a component opens its recipe.
- Components: grouped by type, expandable in place; each says which dishes use it. Filters: my section, drafts, tags, collections.
- Ingredients: A–Z with search; each opens its ingredient page.
- Techniques: grouped by category; filled = has your notes, outlined = name only.
- Search matches dish, component, ingredient and technique names and aliases, and the chef's notes, with results grouped by kind.

## Capture inbox

If capture is slower than paper, the app won't get used mid-shift.

- The capture bar is on every main screen: text, photo, voice note or waste, one tap each, saved instantly, tagged with kitchen, section and time.
- The inbox is sorted later: into a component, dish, technique or kitchen note, a new draft, or deleted. Two taps for the common case.

## Step language and parser

Chefs write each step in their own shorthand, one per line. A rules-based reader on the device turns it into scheduling data for the chef to confirm. Rules rather than AI at the core: offline, consistent, explainable, testable. AI may come later as an optional import helper.

### Where the method comes from

Real notebook entries are mostly ingredient lists; the method lives in the chef's head. So entry starts from what chefs already write: ingredients in shorthand ("bones 2kg, mirepoix, tom puree, thyme, bay"), then a method template for the technique with typical times to accept or change, or dictation after a shift split into steps.

### Tokens

| Token | Examples | Becomes |
| --- | --- | --- |
| Duration | 45 min, 2½ hrs, 1h30, 20–25 min, overnight, min 2 hrs | min/max minutes (max may be open); plans on the upper end by default |
| Temperature | 180°C, 180c, fan 160, gas 4, 425F, low heat | setting (gas and °F converted to °C); heat words imply the hob |
| Equipment | oven, combi, hob, grill, water bath, blast chiller, fridge, blender, mixer | the equipment tied up |
| Verb | roast, simmer, chill / chop, sear, pass / reduce, sweat | default mode |
| Quantity | 10 onions, 2kg bones | link to a line; time scales with it |
| Component | chicken stock, @jus | dependency |
| Doneness cue | until golden, to nappe, until tender | no time: flagged for an estimate |
| Hold point | holds 3 days, rest overnight, cure 24 h | safe pause; long holds move the start to an earlier day |
| Safety cue | cool, chill below, hold hot | critical point |
| Service cue | to order, à la minute | done at service, left out of prep |
| Technique | quenelle, brunoise, mount, nappe | link to the technique |

### Three modes and pausing

1. Active: hands busy the whole time (chop, sear, pass).
2. Check-in: hands-off but needs attention every few minutes (reduce, sweat, skim).
3. Passive: genuinely unattended (roast, braise, chill, cure).

The verb sets the default; other words override it ("sweat 10 min, stirring" → active). Each step also records whether it can be paused for a ticket, and if not, why (cooling, emulsion). The parser must also handle several steps on one line, times relative to the previous step, steps that must follow with no gap, references to another component's method, and look-alikes (63°C in a water bath is cooking, not hot holding). All are in the test fixtures.

### Confirming

Each line shows its readings as chips: `check-in · hob · 30–40 min · needs: chicken stock`. Unfilled fields show as empty chips. Corrections go into the chef's word list and are applied next time.

### Step data

```json
{
  "text": "Reduce stock by half, 30–40 min, skim",
  "mode": "check-in",
  "minutes": { "min": 30, "max": 40 },
  "equipment": { "type": "hob", "setting": null },
  "depends_on": ["component:chicken-stock"],
  "scales_with": null,
  "hold": null,
  "pausable": true,
  "pause_blocker": null,
  "critical_point": null,
  "at_service": false,
  "confirmed": true
}
```

### Testing

`tests/fixtures/step-parser-test-set.json` holds 58 lines built around components from Cedar 1905's published menus at Dumbleton Hall. Methods and times are estimates, to be corrected against real practice. The parser's score against this file measures progress; every real-world miss is added to it.

## The shift sheet

Kitchens run on a sheet (its name is editable: MEP sheet, prep list, job list): at the start of a shift a chef gets a list of prep and top-ups, and at the end of the day writes one for the next shift. The sheet is the home screen.

- Today's sheet lists items (components or section items) with a quantity or a top-up target ("top up to 3 L"), each optionally marked for a service. Ticked items settle to the bottom.
- It comes from the sheet written at the end of the last shift, a paper sheet from chef (photograph it and enter it while looking at the photo), or items picked from the section list.
- Near the end of the shift the app offers to write tomorrow's sheet, pre-filled from unfinished items and, once section admin exists, from the count against pars and items with long holds that must start today. It can be shared as text or PDF. It replaces a separate handover note.

## The prep plan

The plan is today's sheet in time order. It never holds anything the sheet doesn't; ticking an item in one ticks it in the other.

- The shift splits into blocks around service windows: before lunch, the lunch window, the gap before dinner, the dinner window, close-down. Each block has a "ready by" time, the first ticket of the next service.
- The sequence comes first. Where it has a choice, the plan puts pausable and passive jobs inside service windows and keeps jobs that can't be abandoned outside them. When the sequence needs one inside a window anyway, it goes there, flagged "needs cover" with the reason so the chef can arrange it.
- Inside service windows, jobs keep their order but lose the countdown; ticking is optional and the app expects no taps while tickets come in. Anything noticed during service is captured afterwards.
- Drafts appear beside the plan as manual to-dos.
- Steps with long holds (cure 24 h, set overnight) are placed on an earlier day's sheet.

### Starting approach (not a commitment)

1. Work back from each ready-by time to each job's latest start.
2. Start the longest passive chains first.
3. Fill gaps with active jobs, earliest deadline first; never two active steps at once. Check-in steps can overlap passive ones but limit what else can run.
4. Equipment: two jobs can't share an oven at different temperatures; on a clash, the shorter one moves.
5. Show free time and flag anything that can't be ready.

This greedy method is a baseline to beat; alternatives include critical-path scheduling and a constraint solver. The step data is fixed; the algorithm sits behind an interface (`Scheduler.plan(input) → Plan`) so it can be swapped.

### Prep mode and learned timings

- Prep mode shows one task large with a countdown (into negative time when over); one "done" tap starts the next. The screen stays awake.
- On overrun or early finish, only unstarted jobs are re-sequenced, and only when a ready-by time or equipment slot is affected; otherwise it shows "6 min behind".
- Estimates scale with quantity: setup time plus a per-unit rate.
- Learned from "done" taps: the chef's active times (kept everywhere) and each kitchen's equipment times (kept with that kitchen). Median, not mean, recent times weighted more, an "interrupted" tap excludes a timing, and timings taken inside a service window are kept apart. Components keep their written times untouched.

## Food safety

- Allergens are worked out from ingredients and products, through components, for the variation in use (see Ingredients). Shown with where they come from ("mustard: via rémoulade").
- Shelf life is a house rule per kitchen (by component or type), never invented by the app.
- Tapping "made" on a sheet item creates a batch and shows a day-dot label: item, date and time made, use-by, initials.
- Cooling, hot holding and reheating steps are marked with the kitchen's targets. In England the legal limits are hot holding at 63°C or above and chilling at 8°C or below; always defer to the kitchen's HACCP/SFBB pack.
- The app records what the chef enters. It doesn't replace the kitchen's food safety records.

## Section admin

Run your own section the way a sous chef runs a kitchen, so the habits are in place when promotion comes. Every tool feeds at least one other. These are the chef's working figures for their own section, not the kitchen's official records.

- Costing: product prices per supplier and pack (with date); cost per batch and per portion through components, with yield loss per ingredient; GP% per dish on a menu; a flag when a price change drops a dish below target.
- Pars and stock: section items with par levels; a quick count in shelf order with a large number pad, showing below-par items and stock value. The app may suggest a new par from counts and waste.
- Draft orders: below-par items plus upcoming sheets, grouped by supplier with cut-off times. Drafts only; the app never orders.
- Waste log: one tap from the capture bar (item, quantity, reason from an editable list), logged from the first release; costed once prices exist. Feeds GP, par suggestions and over-prep notes.
- Also used elsewhere: when the chef adds or ticks prep using a lot of an ingredient that other dishes use, a quiet line says where ("Chalk stream trout is also on breakfast"). At most it prompts the chef to tell whoever is responsible; their call. No stock estimates for other sections. `seed/dumbleton-hall.json` lists 13 such overlaps as test cases.
- Allergen matrix: a dish × allergen grid exported as PDF or spreadsheet, marked as the chef's working copy. The house matrix rests on supplier spec sheets and the head chef's sign-off.
- Checklists: opening and closing, per section, one tap per item. Official temperature records stay in the kitchen's own system.
- Weekly goal: one line in the chef's words, shown quietly on Today and the Section tab; an end-of-week check-in; history kept. The app may suggest a goal from patterns; the chef writes or chooses it.
- Weekly report: one page for the section: the goal and how it went, stock value, waste and its causes, GP against target, items regularly short. Exported as PDF.

## Editable lists

Seeded defaults, all editable (rename, reorder, merge, hide, add). Kitchen-level lists belong to a kitchen; the rest belong to the chef.

| List | Seeded with | Belongs to |
| --- | --- | --- |
| Sections | starters and garnish, fish, meat, veg, pastry, breakfast | kitchen |
| Services | breakfast, lunch, dinner | kitchen |
| Menu types | à la carte, Sunday lunch, breakfast, set, event | kitchen |
| Courses | nibbles, sides, to begin, mains, to end | kitchen |
| Equipment types | oven, combi, hob, grill, water bath, blast chiller, fridge, blender, mixer | kitchen |
| Checklist items | per section, empty | kitchen |
| Sheet name | "Today's sheet" | kitchen |
| Component types | stocks and jus, sauces and emulsions, pickles and cures, purées and veloutés, doughs and batters, garnishes and crisps, bases | chef |
| Technique categories | knife work, shaping and plating, preserving, sauces, heat | chef |
| Technique names and aliases | a starter set | chef |
| Tags and collections | suggested from menus | chef |
| Waste reasons | out of date, over-prep, dropped, quality, returned | chef |
| Word list (step reader) | verbs → modes and equipment | chef |
| Fixed | the 14 allergens and sub-types, units, the three step modes | app |

Renaming changes the label everywhere; merging moves everything into the kept value; hiding keeps history intact.

## Data model (version 1)

Phase 0 creates this whole schema, including entities whose screens arrive later, so real data never needs a breaking migration. One owner; no user or chef tables.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Kitchen | name, archived, sheet name | "No kitchen" is null |
| Section | kitchen, name, order, hidden | |
| SectionItem | section, component or ingredient, par + unit, shelf position, order | The section's list |
| Checklist | section, kind (open, close), items | |
| Service | kitchen, name, first tickets, last bookings, usual finish, days of week, I work this | A window |
| ShiftPattern | kitchen, start, end, days | e.g. 10:00–22:30 |
| Event | kitchen, date, name, covers, notes, replaces service (optional), menu (optional) | |
| EventService | event, name, start, end | Canapés, wedding breakfast… |
| Equipment | kitchen, name, type | Oven 1, hob rings |
| Supplier | kitchen, name, contact, cut-off, minimum order, delivery days | |
| HouseRule | kitchen, kind (shelf life, label), applies to (component or type), value | |
| Menu | kitchen, name, type, status, starts, ends, copied from | |
| MenuDish | menu, dish, course, order, price, target GP% | A dish's place on a menu |
| MenuSectionAssignment | menu dish, component, section | Which section makes what |
| Dish | name, description, plating photo, plating spec, tags | Exists with or without a menu |
| DishComponent | dish, component, quantity per portion, order | |
| Component | name, type, tags, aliases | The thing; methods live in variations |
| Variation | component, source (house, mine, book/chef, idea), kitchen, forked from, status (draft/ready), base yield + unit, note, suggested to chef (date, response) | |
| Version | variation, parent, created, change note | Every edit |
| Line | version, ingredient or component, product, quantity, unit, prep note, order | |
| Step | version, order, text, mode, minutes min/max, equipment type + setting, depends on, scales with, hold, pausable, pause blocker, critical point, at service, confirmed | |
| Ingredient | name, aliases, kind (basic/bought-in), allergens (basic only), density, yield loss | |
| Product | ingredient, kitchen, supplier, brand, pack + unit, contains, may contain, label photo, checked on, price, price date | |
| Technique | name, aliases, category, notes, mistakes, media | |
| TechniqueVariant | technique, context, notes | |
| TechniqueKitchenNote | technique, kitchen, notes | |
| MethodTemplate | technique, steps | |
| Note | kind (inbox, kitchen, attempt), body, media, kitchen, section, links | |
| Sheet | kitchen, sections, date, covers, written at | |
| SheetItem | sheet, component or section item, quantity or top-up target, service, done, source | The plan reads these |
| Timing | step key, equipment (passive), quantity, minutes, interrupted, in service window | Learned durations |
| Batch | component, kitchen, made at, use-by | Day-dot label |
| StockCount | section, date, counts | |
| OrderDraft | supplier, date, lines | Never sent |
| WasteEntry | kitchen, section, item, quantity, reason, cost, date | |
| WeeklyGoal | week, text, reflection, suggested from | |
| Collection | name, members | |
| ListValue | list, kitchen (optional), value, order, hidden, merged into | Editable lists |
| WordListEntry | word, mode/equipment override | |

## Tech and data ownership

The chef owns their data and the app is agnostic about where it lives. It's local-first:

- a phone-first PWA storing everything on the device (IndexedDB), installed to the home screen: on iPhone through Safari → Share → Add to Home Screen, giving its own icon, full screen and offline use; on Android through the browser's install prompt. No App Store at first; a native wrapper (e.g. Capacitor) can come later from the same code
- updates arrive automatically the next time the app opens; an update must never touch stored data
- the step reader, scaling and scheduler run in the browser; no account, no server
- an open, documented export (`.zip` of `data.json` plus media) and import, from the first usable build
- backup prompts that are hard to miss, because the device holds the only copy
- storage persistence checked in Phase 0: request persistent storage, and test that the installed app keeps its data on iPhone (browsers may clear website storage that goes unused; installing to the home screen and persistent storage are the guards)
- optional, pluggable sync later (the chef's own cloud folder, or a small self-hosted server)
- sharing a recipe = sending a file through the share sheet, a link or a QR code, with a reminder to share only what's yours

Kitchen-proof UX: big tap targets, one-handed and wet-finger use, high contrast, text that follows the phone's own size setting, dark mode, voice capture, screen kept awake in prep mode.

## Business

Free and open source, optional donation link, no subscription for chefs. A kitchen-paid version is a possible separate product later.

## Open questions

- First sync option, if it's ever shared.
- How each employer feels about house recipes on a personal phone; worth asking the head chef before logging house dishes in detail.
- One chef only for the scheduler at first, or a section of two or three?

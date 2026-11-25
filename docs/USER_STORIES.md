# User stories

Each story has an ID, acceptance criteria, a priority and the phase it sits in (BUILD_ORDER.md). Priorities are Must (the app fails without it), Should (expected soon after) and Could (worth doing when there's room). Words follow SPEC → The building blocks: dish, component, ingredient, technique, kitchen.

## Who it's for

| Persona | Situation | What they need most |
| --- | --- | --- |
| Commis / CDP (primary: Louis; the app is built from this view) | Main kitchen, prepping a section, being taught new dishes, aiming for promotion | Fast capture, reliable components, a prep plan, admin habits |
| Agency or relief chef | A new kitchen every week or day, no time to set anything up | Works with no setup; their own components and timings travel with them |
| Home cook (Louis at home) | Batch-cooking the household's meals earlier in the week | Scaling by servings, a plan across several dishes, freezer labels |
| Head chef or sous (receives output) | Doesn't use the app; reads what comes out of it | Accurate allergen sheets, order drafts, section reports they can trust |

---

## First run and settings

**F1. Start in under a minute** (Must, Phase 1)
As a new user, I want to name my kitchen (or skip) and pick my usual section, so that the app is useful straight away and I can set up the rest later.
- Two screens at most; everything skippable.
- Asks for persistent storage and explains backups in one line.

**F2. Use my kitchen's words** (Must, Phase 1)
As a chef whose kitchen says "Starters" not "Larder", I want to rename, reorder, merge or hide any list in the app, so that it speaks my kitchen's language.
- Applies to sections, services, menu types, courses, component types, technique categories, waste reasons, tags and the sheet's name.
- Merging moves everything into the kept value; hiding keeps history.

**F3. App settings** (Must, Phase 1)
As a chef, I want export, import, backup reminders and dark mode in one place, and text that follows my phone's text size, so that I can look after my data and read the screen in any light.

---

## Capture

**C1. Quick note mid-shift** (Must, Phase 1)
As a commis, I want to jot a note in two taps so that I never lose a correction chef gives me during service.
- The capture bar is on every main screen; one tap opens it with the keyboard ready.
- The note saves without a save button, tagged with the current kitchen, section and time.
- Works in airplane mode.

**C2. Photo or voice note** (Must, Phase 1)
As a commis, I want to snap a photo of a plate or dictate a method so that I capture things I can't write down with wet hands.
- Photo and voice are one tap each from capture.
- Media survives export and import.

**C3. Sort the inbox later** (Must, Phase 1; dishes Phase 2, techniques Phase 7)
As a commis, I want to turn inbox notes into components, dishes, technique notes or kitchen notes on my break so that the notebook ends up organised without slowing me down at the time.
- Each item can become a new draft, be attached to something that exists, become a kitchen note, or be deleted.
- Sorting takes two taps for the common case.

---

## Kitchens

**K1. Switch kitchen** (Must, Phase 1)
As an agency chef, I want to switch kitchen from the top bar so that house variations, equipment and suppliers follow the kitchen I'm in.
- The app reopens in the last kitchen used.

**K2. No setup needed** (Must, Phase 1)
As an agency chef on a one-day shift, I want to use the app without creating a kitchen so that it's useful from the first minute.
- "No kitchen" works everywhere, using my own variations.

**K5. Usual services** (Must, Phase 1)
As a chef, I want to set a kitchen's usual services as windows (first tickets to last bookings), my usual shift hours, and which services I work, so that the app always knows when my next service is.
- Times can differ by day of the week.
- Breakfast can be set up and left off if I don't work it.

**K6. Events and changes** (Must, Phase 3)
As a chef with a wedding or function coming up, I want to add it with its own service times and covers so that my sheet and prep plan work to the right times that day.
- Several service times per event (canapés, wedding breakfast, evening food).
- Replaces a usual service or runs alongside it.
- A one-off time change takes two taps from Today.

**K3. Archive a kitchen** (Should, Phase 1)
As a chef who's moved on, I want to archive an old kitchen so that its notes are kept but out of the way.

**K4. Home as a kitchen** (Could, Later)
As a home cook, I want my home kitchen set up with my own oven and hob so that planning at home works the same way as at work.

---

## Library

**R1. Write an ingredient list in shorthand** (Must, Phase 2)
As a commis, I want to type "bones 2kg, mirepoix, tom puree" and have it understood so that entering components is as quick as my notebook.
- Quantity, unit and name are split out; unknown ingredients are created on the fly.
- Lines without quantities are allowed.

**R7. Browse like a cookbook** (Must, Phase 2; menus Phase 6)
As a commis, I want to browse dishes by menu, components by type, ingredients A–Z and techniques by category, and search across all of them, so that I can find "the beetroot one" or "julienne" without knowing where it lives.

**R2. Find it fast** (Must, Phase 2)
As a commis mid-prep, I want to find a component in under three taps so that I check it instead of guessing.
- Search by name, alias or ingredient; filter by my section, drafts, tags, collections.
- Recent items first.

**R3. Tags, not boxes** (Must, Phase 2; suggestions from menus Phase 6)
As a chef, I want to tag dishes and components freely (staff dinner, home, canapé), with suggestions from where they're used, so that I can find things by how I use them without being boxed in: a starter can become a main.

**R4. A dish made of components** (Must, Phase 2)
As a commis learning a new dish, I want the dish to list its components, each opening its recipe, so that I can see everything that goes on the plate and prep each part.

**R5. Draft until it's complete** (Must, Phase 4)
As a chef, I want unfinished variations kept as drafts that tell me what's missing so that I can capture now and finish later, without the plan using bad data.

**R6. Plating reference** (Should, Phase 2)
As a commis, I want a photo and short spec for each dish so that I plate it the way chef wants.

**I1. Look up an ingredient** (Should, Phase 2; techniques applied Phase 7, products Phase 10)
As a chef with a crate of carrots, I want to look up "carrot" and see every dish and component that uses it, the techniques I've applied to it and ideas that mention it, so that I can see the ways I've used it and the ways I could.
- Drawn only from my own book.
- Shows its products, prices and allergens once those exist.

---

## Step parser

**P1. Write steps my way** (Must, Phase 4)
As a chef, I want to write "simmer 2½ hrs, skim" and have the app read the time, equipment and type of step so that the plan gets its data without me filling in forms.
- Readings shown as chips under each line; empty chips for anything it couldn't read.
- Gas marks and °F converted.

**P2. Correct it once** (Must, Phase 4)
As a chef, I want my corrections remembered so that the app learns my shorthand.
- A corrected word is applied to future steps and exported with my data.

**P3. Several steps on one line** (Should, Phase 4)
As a chef, I want "cook down 20 min, blend, pass" split into steps so that I don't have to reformat what I write.

---

## Scaling

**S1. Scale by yield or portions** (Must, Phase 5)
As a commis, I want to scale a component to "3 litres" or a dish to "40 covers" so that I don't do arithmetic under pressure.
- Scaled amounts round to what can be weighed.
- Scaling never changes what's stored.

**S2. Scale from what I've got** (Must, Phase 5)
As a commis who's short of something, I want to scale the whole component from one ingredient ("340g butter left") so that I use what's there without wasting the rest.

**S3. Scale by headcount** (Should, Phase 5)
As someone cooking staff dinner or for the household, I want to scale by number of people so that I make enough without leftovers.

---

## Variations and versions

**V4. Several ways of making it** (Must, Phase 6)
As a commis who's worked in more than one kitchen, I want one component to hold each kitchen's way of making it, with this kitchen's house variation first, so that I follow house style but keep what I've learned elsewhere.
- Other variations as chips under the title; side-by-side compare.
- Plan, scaling, costing and allergens use the variation in use.

**V5. Note an idea** (Should, Phase 6)
As an aspiring CDP who comes across a better way of doing something, I want to note it on the component and mark when I've suggested it to chef, so that I can bring good ideas forward at the right time.

**V1. Keep the house variation and mine** (Should, Phase 6)
As a commis, I want to fork the house variation into my own so that I can experiment without losing what chef taught me.

**V2. Log an attempt** (Should, Phase 6)
As a chef developing a component, I want dated notes on each attempt so that I know what I changed and why.

**V3. Go back** (Should, Phase 6)
As a chef, I want to see earlier versions and restore one so that a bad edit is never permanent.

---

## Techniques and templates

**T1. Look up a technique from a step** (Must, Phase 7)
As a commis asked to quenelle a textured mix, I want to tap the word in the step and see my own notes so that I get it right first time.
- One tap to open, back returns to the same place.
- Variants by context (smooth vs textured mixes).

**T2. Kitchen-specific technique notes** (Should, Phase 7)
As a commis, I want notes like "three-sided quenelles here" stored against this kitchen so that I follow house style without mixing it up with other kitchens.

**T3. Method from a template** (Must, Phase 7)
As a chef whose notebook is mostly ingredient lists, I want to pick "brown stock" and get a method with typical times so that the variation becomes ready with only corrections.

---

## Menus and sections

**MS1. See the whole menu** (Must, Phase 6)
As a commis, I want the current menu by course, filterable to mine, so that I know every dish and which parts are mine.
- Each dish shows the sections it touches and whether its components are ready.

**MS2. Open a dish** (Must, Phase 6)
As a commis learning a dish, I want its plating spec and components, each linked to its recipe, so that I can prep and plate it properly.
- Allergens gathered from all components; one tap to add components to today's sheet.

**MS3. Switch section** (Must, Phase 3; changed 25 Nov 2026, DECISIONS 48)
As a commis moved to fish for the day, I want to switch section in two taps so that my sheet, pars and count follow me, while my components and notes stay with me.
- Now: the app doesn't ask which section you're on. Today's sheet is the kitchen's; any section's list is one tap away on its chip, so moving to fish costs nothing.

**MS4. Change the menu** (Must, Phase 6)
As a commis at the start of a new season, I want to copy the current menu and change what's new, and to see how ready the coming-up menu is, so that I've learned the new dishes before launch day.
- Old menus move to past, stay searchable, and their dishes and components are kept.

---

## Shift sheet

**SH1. Today's sheet** (Must, Phase 3)
As a commis starting a shift, I want my sheet on the home screen with quantities and top-ups to tick off so that I know exactly what to do and how far through I am.
- Progress shown at the top; ticked items settle to the bottom.
- Drafts appear with a marker.

**SH2. Enter chef's paper sheet** (Must, Phase 3)
As a commis handed a paper sheet, I want to photograph it and enter it quickly while looking at the photo, or pick items from my section list, so that the app holds the real sheet within a couple of minutes.
- Automatic reading of the photo comes later.

**SH3. Write tomorrow's sheet** (Must, Phase 3; smart pre-fill Phase 11)
As a commis at the end of a shift, I want to write the next shift's sheet in a couple of minutes so that whoever's on next starts with a clear list.
- Unfinished items carried over automatically.
- From Phase 11: pre-filled from the count against pars and anything with a long hold that must start today.
- Share as text or PDF.

---

## Prep plan

**PS1. Plan my prep** (Must, Phase 8)
As a commis with eight jobs before service, I want today's sheet put in an order that works back from my next service so that long jobs start first and my hands are never idle.
- Respects active, check-in and passive steps, dependencies and equipment.
- Shows free time, and flags anything that can't be ready.

**PS5. Prep in the gaps** (Must, Phase 8)
As a commis whose lunch service runs for hours, I want the plan to keep prep efficient through service, favouring jobs I can drop for a ticket and flagging the ones I can't, so that prep carries on around service and I can arrange cover when I need it.
- The shift is split into blocks with a "ready by" time for each service.
- Efficiency comes first: a job that can't be dropped goes inside a service window if the sequence needs it, flagged "needs cover" with the reason.

**PS2. Drafts as manual to-dos** (Must, Phase 8)
As a commis, I want draft items beside the plan as plain to-dos so that nothing is forgotten even if it can't be scheduled.

**PS3. Prep over two days** (Should, Phase 8)
As a commis, I want jobs with long holds (cures, overnight sets) put on the previous day's sheet so that they're ready when needed.

**PS4. Plan a home batch-cook** (Could, Later)
As a home cook, I want to plan several meals in one session with the oven and hob I have so that a whole week's cooking fits into one afternoon.

---

## Prep mode and timers

**SM1. One task at a time** (Must, Phase 9)
As a commis during prep, I want the current task large on screen with a countdown so that I can follow the plan with a glance.
- One tap on "done" starts the next task.
- Countdown carries on into negative time.

**SM2. The plan adapts** (Must, Phase 9)
As a commis running late, I want only the unstarted jobs re-ordered, and only when it matters, so that the plan stays usable instead of jumping around.

**SM3. Learn my times** (Should, Phase 9)
As a commis getting faster, I want the app to learn how long jobs take me so that the plan gets more accurate each week.
- Median of recent times; "interrupted" excludes a timing.
- My active times go with me to a new kitchen; oven timings stay with that kitchen.

**SM4. Screen stays on** (Must, Phase 9)
As a commis with a phone on the shelf, I want the screen kept awake in prep mode so that I don't unlock it with greasy fingers.

---

## Food safety

**FS1. Allergens follow the components** (Must, Phase 10)
As a commis, I want every dish's and component's allergens worked out from its ingredients and components so that I can answer the pass correctly.
- Shows where each allergen comes from.

**FS5. Know exactly what's in it** (Must, Phase 10)
As a commis asked about allergens at the pass, I want each bought-in ingredient linked to the exact product this kitchen uses, so that the answer is right for this kitchen's variation and never a guess.
- "Contains" and "may contain" kept separate; label photo and date checked.
- An unconfirmed product shows as "not confirmed", never as allergen-free.

**FS2. Day-dot label** (Should, Phase 10)
As a commis, I want to tap "made" and see the label details with the use-by from the kitchen's own rules so that labelling is quick and consistent.

**FS3. Critical points flagged** (Should, Phase 10)
As a commis, I want cooling and hot-holding steps marked with the kitchen's targets so that I don't miss a temperature check.

**FS4. Freezer labels at home** (Could, Later)
As a home cook, I want a label for batch-cooked meals with the date and contents so that the freezer doesn't become a mystery.

---

## Section admin

**A1. Cost a dish** (Should, Phase 11)
As an aspiring CDP, I want cost per portion and GP% for each dish so that I understand the money behind the menu.
- Prices from products, yield loss per ingredient, costs through components.
- Flag when a price change drops a dish below target GP.

**A2. Count my section** (Should, Phase 11)
As a commis running a section, I want to count stock in under five minutes so that I know what's below par and what it's worth.

**A3. Draft an order** (Should, Phase 11)
As a CDP, I want below-par items and upcoming sheets turned into a draft order per supplier, with cut-off times, so that ordering is quick and nothing is missed.
- The app never places an order.

**A4. Log waste** (Should; logging Phase 1, costs and analysis Phase 11)
As an aspiring CDP, I want to log waste in one tap with a reason so that I can see what it costs and fix the cause.
- Logged from capture from day one, so the history exists by the time costing arrives.

**A5. Allergen matrix** (Should, Phase 11)
As a CDP, I want a dish × allergen grid exported from my book so that I can cross-check the house matrix.
- Marked as a working copy.

**A6. Opening and closing checks** (Should, Phase 11)
As a commis, I want a tick-through checklist for my section so that nothing is forgotten at the start or end of a shift.

**A9. Where else is this used?** (Should, Phase 11)
As a commis about to use a lot of something, I want a quiet note of which other dishes and services use it, so that I can go easy or let the right person know.
- At most, a prompt to tell someone (one tap saves a reminder or a heads-up on tomorrow's sheet); their call what to do about it.
- No estimates of other sections' stock.

**A8. Weekly section report** (Should, Phase 11)
As a commis aiming for promotion, I want a one-page weekly report on my section so that I can show the head chef I'm already managing it.
- Includes the week's goal and how it went (G1).

(A7, handover, is covered by SH3.)

---

## Goals

**G1. A weekly goal** (Should; Phase 1, suggestions Phase 11)
As a chef working towards promotion, I want to set a short goal for the week in my own words and see it as a constant small reminder so that I keep working on it during shifts.
- Free text, one goal per week. It doesn't affect any data.
- One quiet line on Today and the Section tab; one tap opens it.
- At the end of the week, a one-tap prompt asks how it went, and the goal is kept in a history.
- From Phase 11, the app can suggest a goal from patterns. The chef chooses whether to use it.

---

## Data and sharing

**D1. Export everything** (Must, Phase 0–1)
As a chef who owns my data, I want to export everything to one file and import it back so that I never lose my notebook.

**D2. Backup reminder** (Must, Phase 1)
As a chef whose phone holds the only copy, I want a backup reminder I can't miss so that I'm never more than a week from losing work.

**D3. Send a component or dish** (Should, Phase 12)
As a chef, I want to send one to another chef through WhatsApp or a QR code so that sharing is as easy as passing over my notebook.
- A reminder to share only what's mine.

**D4. Use it on two devices** (Could, Phase 12)
As a chef with a phone and a tablet, I want my notebook on both so that I can plan at home on a bigger screen.

---

## Decisions from review

24 Nov 2026 (first review):

1. The whole spec is the target product. The build still goes phase by phase, with each phase usable on a real shift before the next starts.
2. Scaling stays after the parser.
3. Home batch-cooking (K4, PS4, FS4) is an extra: moved to Later.
4. Waste logging moves into capture in Phase 1; costs and analysis stay in section admin.
5. New: weekly personal goal (G1).

24 Nov 2026 (consistency review):

6. Words: dish, component, ingredient (DECISIONS 17). R3 is now tags; new I1 ingredient lookup.
7. Every list is editable (F2, DECISIONS 16). New F1 first run and F3 app settings.
8. Old Phase 2 split into Library (2) and Shift sheet (3); later phases renumbered.

/**
 * The shape of everything Mep stores: schema version 1 (SPEC → Data model).
 * One interface per table. Only the fields listed in db.ts are indexed; every
 * other field is simply stored, so adding a field later needs no migration.
 *
 * Conventions
 * - Every row has `id`, `createdAt` and `updatedAt` (see Row). The database
 *   fills them in (db.ts hooks), so callers never set them by hand.
 * - Timestamps are ISO strings in UTC. Calendar dates are "YYYY-MM-DD" in the
 *   chef's local time (a sheet's date doesn't move with time zones). Times of
 *   day are "HH:MM", 24-hour.
 * - Days of the week are 1–7, Monday = 1 (ISO).
 * - Money is whole pence (integers), never pounds as a float.
 * - A field ending in `Id` points at a row in another table. Fields for an
 *   editable list (course, component type, tags…) point at a ListValue,
 *   never hold the text (DECISIONS 16).
 *
 * Kitchens: `kitchenId` has two meanings (DECISIONS 30)
 * - KitchenId ("where"): the place something happened or belongs. Never null:
 *   "No kitchen" is a real Kitchen row with id NO_KITCHEN_ID ("none").
 * - KitchenId | null ("tied to a kitchen?"): null means it belongs to the
 *   chef and travels with them (their own variations, techniques, chef-level
 *   lists). IndexedDB can't index null, so query those by another index.
 */

import type { AllergenId } from '../core/allergens/allergens';
import type { StepMode } from '../core/parser/parseStep';
import type { Id } from './ids';

export type { Id };

/** The built-in "No kitchen" record's id. */
export const NO_KITCHEN_ID = 'none';

/** A kitchen id used to mean "where". "none" for no kitchen, never null. */
export type KitchenId = Id;

/** "YYYY-MM-DD", local calendar date. */
export type CalendarDate = string;
/** "HH:MM", 24-hour. */
export type TimeOfDay = string;
/** 1 (Monday) to 7 (Sunday). */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Whole pence. */
export type Pence = number;

/** An amount with its unit: 2 kg, 500 ml, 12 each. Units are fixed by the app. */
export interface Quantity {
  amount: number;
  unit: string;
}

/** Fields every stored row has. Filled in by the database. */
export interface Row {
  id: Id;
  createdAt: string;
  updatedAt: string;
}

// ─── Kitchen ──────────────────────────────────────────────────────────────

export interface Kitchen extends Row {
  name: string;
  archived: boolean;
  /** The kitchen's word for the sheet: "MEP sheet", "prep list"… */
  sheetName: string;
  /** True for the "No kitchen" record, which can't be renamed or deleted. */
  builtIn: boolean;
  /** The chef's usual section here; the app opens on it (schema v2). */
  usualSectionId: Id | null;
}

export interface Section extends Row {
  kitchenId: KitchenId;
  name: string;
  order: number;
  hidden: boolean;
  /** Set when merged into another section; everything now points there (schema v2). */
  mergedIntoId: Id | null;
}

/** One thing on a section's list: a component or an ingredient. */
export interface SectionItem extends Row {
  sectionId: Id;
  componentId: Id | null;
  ingredientId: Id | null;
  par: Quantity | null;
  /** Where it sits, for counting in shelf order: "walk-in, shelf 2". */
  shelfPosition: string | null;
  order: number;
}

export interface ChecklistItem {
  id: Id;
  text: string;
  order: number;
}

export interface Checklist extends Row {
  sectionId: Id;
  kind: 'open' | 'close';
  items: ChecklistItem[];
}

/** One stretch of a service on given days: first tickets to last bookings. */
export interface ServiceWindow {
  days: DayOfWeek[];
  firstTickets: TimeOfDay | null;
  lastBookings: TimeOfDay | null;
  usualFinish: TimeOfDay | null;
}

/**
 * A service (breakfast, lunch, dinner…): an editable list item holding its
 * times. Times can differ by day, so it has a list of windows, each for some
 * days (DECISIONS 32; SPEC's flat fields became `windows` in schema v2).
 */
export interface Service extends Row {
  kitchenId: KitchenId;
  name: string;
  order: number;
  hidden: boolean;
  mergedIntoId: Id | null;
  iWorkThis: boolean;
  windows: ServiceWindow[];
}

/** The chef's usual hours in this kitchen: 10:00–22:30 on given days. */
export interface ShiftPattern extends Row {
  kitchenId: KitchenId;
  start: TimeOfDay;
  end: TimeOfDay;
  days: DayOfWeek[];
}

/** A wedding, function or one-off time change on one date. */
export interface Event extends Row {
  kitchenId: KitchenId;
  date: CalendarDate;
  name: string;
  covers: number | null;
  notes: string;
  /** The usual service it replaces; null = runs alongside. */
  replacesServiceId: Id | null;
  menuId: Id | null;
}

/** One of an event's service times: canapés, wedding breakfast… */
export interface EventService extends Row {
  eventId: Id;
  name: string;
  start: TimeOfDay;
  end: TimeOfDay | null;
}

export interface Equipment extends Row {
  kitchenId: KitchenId;
  name: string;
  /** ListValue in 'equipment-types'. */
  typeId: Id;
}

export interface Supplier extends Row {
  kitchenId: KitchenId;
  name: string;
  contact: string;
  /** Order cut-off, e.g. "14:00 the day before". */
  cutOff: string | null;
  minimumOrder: Pence | null;
  deliveryDays: DayOfWeek[];
}

/** A kitchen rule: shelf life or label format, for a component or a component type. */
export interface HouseRule extends Row {
  kitchenId: KitchenId;
  kind: 'shelf-life' | 'label';
  componentId: Id | null;
  /** ListValue in 'component-types'. */
  componentTypeId: Id | null;
  value: string;
}

// ─── Menus ────────────────────────────────────────────────────────────────

export type MenuStatus = 'coming-up' | 'on-now' | 'past';

export interface Menu extends Row {
  kitchenId: KitchenId;
  name: string;
  /** ListValue in 'menu-types'. */
  typeId: Id | null;
  status: MenuStatus;
  starts: CalendarDate | null;
  ends: CalendarDate | null;
  copiedFromId: Id | null;
}

/** A dish's place on a menu. */
export interface MenuDish extends Row {
  menuId: Id;
  dishId: Id;
  /** ListValue in 'courses'. */
  courseId: Id | null;
  order: number;
  price: Pence | null;
  targetGpPercent: number | null;
}

/** Which section makes which component of a dish on this menu. */
export interface MenuSectionAssignment extends Row {
  menuDishId: Id;
  componentId: Id;
  sectionId: Id;
}

// ─── Library ──────────────────────────────────────────────────────────────

export interface Dish extends Row {
  name: string;
  description: string;
  /** Media row. */
  platingPhotoId: Id | null;
  platingSpec: string;
  /** ListValues in 'tags'. */
  tagIds: Id[];
}

export interface DishComponent extends Row {
  dishId: Id;
  componentId: Id;
  quantityPerPortion: Quantity | null;
  order: number;
}

/** The thing itself ("chicken jus"). How to make it lives in its variations. */
export interface Component extends Row {
  name: string;
  /** ListValue in 'component-types'. */
  typeId: Id | null;
  /** ListValues in 'tags'. */
  tagIds: Id[];
  aliases: string[];
}

export type VariationSource = 'house' | 'mine' | 'book' | 'idea';

/** One way of making a component (DECISIONS 18: status and kitchen live here). */
export interface Variation extends Row {
  componentId: Id;
  source: VariationSource;
  /** Who or where it came from, for book/chef and ideas: "Leiths", "Chef Tom". */
  sourceDetail: string | null;
  /** The kitchen for a house variation; null = the chef's own, not tied to a kitchen. */
  kitchenId: KitchenId | null;
  forkedFromId: Id | null;
  status: 'draft' | 'ready';
  baseYield: Quantity | null;
  note: string;
  suggestedToChef: { on: CalendarDate; response: string | null } | null;
  /** The latest Version: its lines and steps are the recipe as it stands. */
  currentVersionId: Id | null;
}

/** A saved state of a variation. Every edit makes one. */
export interface Version extends Row {
  variationId: Id;
  parentId: Id | null;
  changeNote: string | null;
}

/** One ingredient line: an ingredient or another component. */
export interface Line extends Row {
  versionId: Id;
  ingredientId: Id | null;
  componentId: Id | null;
  productId: Id | null;
  quantity: number | null;
  unit: string | null;
  prepNote: string;
  order: number;
}

/** How long something keeps once made, and where: "holds 3 days" → fridge, "hold warm max 2 hrs" → warm. */
export interface Hold {
  minutes: number;
  /** "fridge", "freezer" or "warm". */
  where: string;
}

/**
 * One method step: a line as the chef wrote it, and the parts the step reader
 * found in it (SPEC → Step data; DECISIONS 38). "Cook down 20 min, blend, pass"
 * is one Step with three parts; the planner schedules parts.
 */
export interface Step extends Row {
  versionId: Id;
  order: number;
  /** The line exactly as written. */
  text: string;
  parts: StepPart[];
  /** The chef has checked the readings (SPEC → Confirming). */
  confirmed: boolean;
}

/** One piece of work within a step. null = not read yet: an empty chip. */
export interface StepPart {
  /** The words of the line this part came from. */
  text: string;
  /** The word that set the mode and equipment; a correction teaches the word list this. */
  verb: string | null;
  mode: StepMode | null;
  minutesMin: number | null;
  /** null with a min = "at least min". */
  minutesMax: number | null;
  /** ListValue in 'equipment-types'. */
  equipmentTypeId: Id | null;
  /** "220°C", "160°C fan", "low". */
  equipmentSetting: string | null;
  /** Needs a look this often ("skim every hour" → 60). */
  checkEveryMinutes: number | null;
  /** Components this part needs first. */
  dependsOnComponentIds: Id[];
  /** The Line whose quantity this part's time scales with. */
  scalesWithLineId: Id | null;
  /** Follows another component's method ("then as brown stock"). */
  templateComponentId: Id | null;
  hold: Hold | null;
  pausable: boolean;
  /** Why it can't be paused for a ticket: "cooling", "emulsion", "hot-hold". */
  pauseBlocker: string | null;
  /** "cooling" or "hot-hold". */
  criticalPoint: string | null;
  /** Done at service ("to order"), left out of prep. */
  atService: boolean;
  /** Its time runs on from the step before ("roast 15 more"). */
  relativeTime: boolean;
  /** Must follow the step before at once ("while hot"). */
  noGap: boolean;
  /** Starts the day before. */
  previousDay: boolean;
}

export interface Ingredient extends Row {
  name: string;
  aliases: string[];
  kind: 'basic' | 'bought-in';
  /** For basic ingredients; bought-in ones get theirs from a Product. */
  allergens: AllergenId[];
  /** Grams per millilitre, for volume ↔ weight. */
  density: number | null;
  /**
   * The chef's own weights for counts and rough measures, in grams per one:
   * { handful: 40, each: 55, knob: 15 } (DECISIONS 41). Used to scale across
   * kinds of measure and to estimate when scaling.
   */
  unitWeights: Partial<Record<string, number>>;
  yieldLossPercent: number | null;
}

/** The exact bought-in product a kitchen uses for an ingredient (FS5). */
export interface Product extends Row {
  ingredientId: Id;
  kitchenId: KitchenId;
  supplierId: Id | null;
  brand: string;
  pack: Quantity | null;
  contains: AllergenId[];
  mayContain: AllergenId[];
  labelPhotoId: Id | null;
  checkedOn: CalendarDate | null;
  price: Pence | null;
  priceDate: CalendarDate | null;
}

// ─── Techniques ───────────────────────────────────────────────────────────

export interface Technique extends Row {
  name: string;
  aliases: string[];
  /** ListValue in 'technique-categories'. */
  categoryId: Id | null;
  notes: string;
  mistakes: string;
  mediaIds: Id[];
}

export interface TechniqueVariant extends Row {
  techniqueId: Id;
  /** "smooth mixes", "textured mixes" */
  context: string;
  notes: string;
}

export interface TechniqueKitchenNote extends Row {
  techniqueId: Id;
  kitchenId: KitchenId;
  notes: string;
}

/** A template step: the parts of a Step that make sense before a recipe exists. */
export type TemplateStep = Pick<Step, 'text' | 'parts'>;

export interface MethodTemplate extends Row {
  techniqueId: Id;
  steps: TemplateStep[];
}

// ─── Shift ────────────────────────────────────────────────────────────────

/** What a note is attached to once sorted. */
export interface NoteLink {
  kind: 'dish' | 'component' | 'variation' | 'ingredient' | 'technique' | 'kitchen';
  id: Id;
}

export interface Note extends Row {
  kind: 'inbox' | 'kitchen' | 'attempt';
  body: string;
  mediaIds: Id[];
  /** Where it was captured; "none" with no kitchen. */
  kitchenId: KitchenId;
  sectionId: Id | null;
  links: NoteLink[];
}

export interface Sheet extends Row {
  kitchenId: KitchenId;
  /** One, or two when covering two sections (MS3). */
  sectionIds: Id[];
  date: CalendarDate;
  covers: number | null;
  /** When it was written (e.g. at the end of the previous shift). */
  writtenAt: string | null;
  /** The photo of chef's paper sheet it was entered from (schema v3, DECISIONS 35). */
  photoId: Id | null;
}

export type SheetItemSource = 'carried-over' | 'paper' | 'section-list' | 'dish' | 'manual';

export interface SheetItem extends Row {
  sheetId: Id;
  componentId: Id | null;
  sectionItemId: Id | null;
  /** Free text for an item that's neither, e.g. typed from a paper sheet. */
  text: string | null;
  quantity: Quantity | null;
  /** "Top up to 3 L" instead of a quantity. */
  topUpTo: Quantity | null;
  serviceId: Id | null;
  done: boolean;
  order: number;
  source: SheetItemSource;
}

/**
 * A step part started in prep mode today (SM1, schema v6): when it started,
 * when it was done, and whether it was interrupted. Lets prep mode pick up
 * where it was after the app is closed, and feeds learned times.
 */
export interface PartRun extends Row {
  kitchenId: KitchenId;
  date: CalendarDate;
  /** The plan's job: a sheet item's id (or "tomorrow-<id>" for a day-before step). */
  jobId: string;
  /** The part within the job. */
  partKey: string;
  /** Same recipe, same wording (DECISIONS 51): what learned times are keyed by. */
  stepKey: string | null;
  mode: StepMode;
  equipmentTypeId: Id | null;
  /** Batch size as a multiple of the recipe, if known. */
  quantity: number | null;
  startedAt: string;
  doneAt: string | null;
  interrupted: boolean;
  /** Started during a service window: its time is kept apart. */
  inServiceWindow: boolean;
}

/** One recorded duration, for learning how long steps take (SM3). */
export interface Timing extends Row {
  /** Which step this was: stable across versions, defined in Phase 9. */
  stepKey: string;
  /** For passive steps: the kitchen's equipment it ran in. */
  equipmentId: Id | null;
  kitchenId: KitchenId;
  quantity: number | null;
  minutes: number;
  interrupted: boolean;
  inServiceWindow: boolean;
}

/** A batch made: feeds the day-dot label. */
export interface Batch extends Row {
  componentId: Id;
  kitchenId: KitchenId;
  madeAt: string;
  useBy: string | null;
}

export interface StockCount extends Row {
  sectionId: Id;
  date: CalendarDate;
  counts: { sectionItemId: Id; quantity: Quantity }[];
}

export interface OrderLine {
  productId: Id | null;
  ingredientId: Id | null;
  quantity: Quantity;
}

/** A draft order. Never sent by the app. */
export interface OrderDraft extends Row {
  supplierId: Id;
  date: CalendarDate;
  lines: OrderLine[];
}

export interface WasteEntry extends Row {
  kitchenId: KitchenId;
  sectionId: Id | null;
  componentId: Id | null;
  ingredientId: Id | null;
  /** What was wasted, when it isn't a component or ingredient yet. */
  text: string | null;
  quantity: Quantity | null;
  /** ListValue in 'waste-reasons'. */
  reasonId: Id | null;
  /** Filled in once prices exist (Phase 11). */
  cost: Pence | null;
  date: CalendarDate;
}

export interface WeeklyGoal extends Row {
  /** ISO week: "2026-W48". */
  week: string;
  text: string;
  reflection: string | null;
  /** Set when the goal came from an app suggestion (Phase 11). */
  suggestedFrom: string | null;
}

export interface CollectionMember {
  kind: 'dish' | 'component' | 'technique';
  id: Id;
}

export interface Collection extends Row {
  name: string;
  members: CollectionMember[];
}

// ─── Lists, words, media, settings ────────────────────────────────────────

/** Every editable list kept in ListValue (DECISIONS 16). */
export type ListName =
  | 'menu-types'
  | 'courses'
  | 'equipment-types'
  | 'component-types'
  | 'technique-categories'
  | 'tags'
  | 'waste-reasons';

/** One value in an editable list. Kitchen lists have a kitchenId; the chef's own have null. */
export interface ListValue extends Row {
  list: ListName;
  kitchenId: KitchenId | null;
  value: string;
  order: number;
  hidden: boolean;
  /** Set when merged into another value; everything now points there. */
  mergedIntoId: Id | null;
}

/** A correction to the step reader: this word means this mode or equipment. */
export interface WordListEntry extends Row {
  word: string;
  mode: StepMode | null;
  equipmentTypeId: Id | null;
}

/** A photo or voice note. Other rows point at it by id. */
export interface Media extends Row {
  blob: Blob;
  /** MIME type, e.g. "image/jpeg", "audio/mp4". */
  type: string;
}

/** App settings: one row per key. */
export interface Setting {
  key: string;
  value: unknown;
}

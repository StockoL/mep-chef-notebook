import Dexie, { type EntityTable } from 'dexie';
import { addBenchOnce, seedChefLists, seedNoKitchenEquipment } from './defaults';
import { newId, nowTimestamp } from './ids';
import { ROW_FIXES } from './migrations';
import {
  NO_KITCHEN_ID,
  type Batch,
  type Checklist,
  type Collection,
  type Component,
  type Dish,
  type DishComponent,
  type Equipment,
  type Event,
  type EventService,
  type HouseRule,
  type Ingredient,
  type Kitchen,
  type Line,
  type ListValue,
  type Media,
  type Menu,
  type MenuDish,
  type MenuSectionAssignment,
  type MethodTemplate,
  type Note,
  type OrderDraft,
  type Product,
  type Row,
  type Section,
  type SectionItem,
  type Service,
  type Setting,
  type Sheet,
  type SheetItem,
  type ShiftPattern,
  type Step,
  type StockCount,
  type Supplier,
  type Technique,
  type TechniqueKitchenNote,
  type TechniqueVariant,
  type Timing,
  type Variation,
  type Version,
  type WasteEntry,
  type WeeklyGoal,
  type WordListEntry,
} from './types';

/**
 * Schema version 1: every table in SPEC → Data model, plus media and settings
 * (DECISIONS 20, 29). Each string lists the primary key, then the indexes:
 *   'id, kitchenId'      look up by kitchenId
 *   '[kitchenId+date]'   compound: kitchen and date together
 *   '*tagIds'            multi-entry: one index entry per array item
 *   '&word'              unique
 * Only indexed fields appear here; every other field is still stored.
 * Booleans can't be indexed in IndexedDB, so none are.
 *
 * NEVER edit this object once released. A change is a new version:
 *   this.version(n).stores({ …changed tables… }).upgrade(tx => …)
 * and, for changes to the rows themselves, an entry in migrations.ts.
 */
export const SCHEMA_V1 = {
  kitchens: 'id',
  sections: 'id, kitchenId',
  sectionItems: 'id, sectionId, componentId, ingredientId',
  checklists: 'id, sectionId',
  services: 'id, kitchenId',
  shiftPatterns: 'id, kitchenId',
  events: 'id, date, [kitchenId+date]',
  eventServices: 'id, eventId',
  equipment: 'id, kitchenId',
  suppliers: 'id, kitchenId',
  houseRules: 'id, kitchenId',
  menus: 'id, kitchenId, [kitchenId+status]',
  menuDishes: 'id, menuId, dishId',
  menuSectionAssignments: 'id, menuDishId, componentId, sectionId',
  dishes: 'id, name, *tagIds',
  dishComponents: 'id, dishId, componentId',
  components: 'id, name, typeId, *tagIds, *aliases',
  variations: 'id, componentId, kitchenId',
  versions: 'id, variationId',
  lines: 'id, versionId, ingredientId, componentId, productId',
  steps: 'id, versionId',
  ingredients: 'id, name, *aliases',
  products: 'id, ingredientId, kitchenId, supplierId',
  techniques: 'id, name, categoryId, *aliases',
  techniqueVariants: 'id, techniqueId',
  techniqueKitchenNotes: 'id, techniqueId, kitchenId',
  methodTemplates: 'id, techniqueId',
  notes: 'id, kind, kitchenId, createdAt',
  sheets: 'id, date, [kitchenId+date]',
  sheetItems: 'id, sheetId, componentId',
  timings: 'id, stepKey',
  batches: 'id, componentId, kitchenId',
  stockCounts: 'id, sectionId',
  orderDrafts: 'id, supplierId',
  wasteEntries: 'id, kitchenId, date',
  weeklyGoals: 'id, &week',
  collections: 'id',
  listValues: 'id, list, [list+kitchenId]',
  wordListEntries: 'id, &word',
  media: 'id',
  settings: 'key',
} as const;

export type TableName = keyof typeof SCHEMA_V1;

/**
 * The schema version this code writes. Goes into every export.
 * v1: Phase 0. v2: Phase 1 row changes. v3: Phase 3, sheets keep a photo.
 * (Row changes are in migrations.ts; indexes unchanged since v1.)
 */
export const SCHEMA_VERSION = 5;

/** Every table name, in schema order. */
export const TABLE_NAMES = Object.keys(SCHEMA_V1) as TableName[];

/** What you pass to add(): a row without id and timestamps (the hooks add those). */
export type Insert<T extends Row> = Omit<T, keyof Row> & Partial<Row>;

/** A table of rows with an `id` key. */
type RowTable<T extends Row> = EntityTable<T, 'id', Insert<T>>;

export class MepDatabase extends Dexie {
  // `declare` says "Dexie creates these"; TypeScript adds no code for them.
  declare kitchens: RowTable<Kitchen>;
  declare sections: RowTable<Section>;
  declare sectionItems: RowTable<SectionItem>;
  declare checklists: RowTable<Checklist>;
  declare services: RowTable<Service>;
  declare shiftPatterns: RowTable<ShiftPattern>;
  declare events: RowTable<Event>;
  declare eventServices: RowTable<EventService>;
  declare equipment: RowTable<Equipment>;
  declare suppliers: RowTable<Supplier>;
  declare houseRules: RowTable<HouseRule>;
  declare menus: RowTable<Menu>;
  declare menuDishes: RowTable<MenuDish>;
  declare menuSectionAssignments: RowTable<MenuSectionAssignment>;
  declare dishes: RowTable<Dish>;
  declare dishComponents: RowTable<DishComponent>;
  declare components: RowTable<Component>;
  declare variations: RowTable<Variation>;
  declare versions: RowTable<Version>;
  declare lines: RowTable<Line>;
  declare steps: RowTable<Step>;
  declare ingredients: RowTable<Ingredient>;
  declare products: RowTable<Product>;
  declare techniques: RowTable<Technique>;
  declare techniqueVariants: RowTable<TechniqueVariant>;
  declare techniqueKitchenNotes: RowTable<TechniqueKitchenNote>;
  declare methodTemplates: RowTable<MethodTemplate>;
  declare notes: RowTable<Note>;
  declare sheets: RowTable<Sheet>;
  declare sheetItems: RowTable<SheetItem>;
  declare timings: RowTable<Timing>;
  declare batches: RowTable<Batch>;
  declare stockCounts: RowTable<StockCount>;
  declare orderDrafts: RowTable<OrderDraft>;
  declare wasteEntries: RowTable<WasteEntry>;
  declare weeklyGoals: RowTable<WeeklyGoal>;
  declare collections: RowTable<Collection>;
  declare listValues: RowTable<ListValue>;
  declare wordListEntries: RowTable<WordListEntry>;
  declare media: RowTable<Media>;
  declare settings: EntityTable<Setting, 'key'>;

  constructor(name = 'mep') {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    // Later versions change no indexes, only rows: run each table's fix over what's stored.
    for (const version of [2, 3, 4, 5]) {
      this.version(version)
        .stores({})
        .upgrade(async (transaction) => {
          for (const [table, fix] of Object.entries(ROW_FIXES[version] ?? {})) {
            await transaction.table(table).toCollection().modify((row) => fix(row));
          }
        });
    }
    this.addRowHooks();
  }

  /**
   * Every row table fills in its own id and timestamps:
   * - on create: id, createdAt and updatedAt, unless already given (import
   *   gives them, and they must survive the round trip);
   * - on update: updatedAt, unless the update sets it itself.
   */
  private addRowHooks() {
    for (const table of this.tables) {
      if (table.name === 'settings') continue;

      table.hook('creating', (_primaryKey, row: Partial<Row>) => {
        const now = nowTimestamp();
        row.id ??= newId();
        row.createdAt ??= now;
        row.updatedAt ??= row.createdAt;
      });

      table.hook('updating', (changes: Partial<Row>) => {
        if ('updatedAt' in changes) return undefined;
        return { updatedAt: nowTimestamp() };
      });
    }
  }
}

/** The app's one database. Screens reach it through src/data, never directly. */
export const db = new MepDatabase();

/**
 * Makes sure built-in rows exist: the "No kitchen" record (DECISIONS 30) and
 * the chef's own lists with their starting values (DECISIONS 16). Safe to
 * call on every start and after every import.
 */
export async function ensureBuiltIns(database: MepDatabase = db): Promise<void> {
  await database.transaction('rw', database.kitchens, database.listValues, async () => {
    const existing = await database.kitchens.get(NO_KITCHEN_ID);
    if (!existing) {
      await database.kitchens.add({
        id: NO_KITCHEN_ID,
        name: 'No kitchen',
        archived: false,
        sheetName: "Today's sheet",
        builtIn: true,
        usualSectionId: null,
      });
    }
    await seedChefLists(database);
    await seedNoKitchenEquipment(database, NO_KITCHEN_ID);
  });
  await addBenchOnce(database);
}

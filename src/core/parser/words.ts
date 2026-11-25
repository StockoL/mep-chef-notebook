/**
 * The step reader's built-in vocabulary: kitchen verbs and what they usually
 * mean, equipment words, and the cue phrases that set flags. The chef's own
 * word list (corrections) is laid over the verbs at read time.
 *
 * Words are matched against normalised text: lower case, no accents,
 * "w/" → "with", "thru" → "through" (see normaliseStepText).
 */

import type { StepMode } from './parseStep';

/**
 * Equipment names the reader knows. They match the starting values of the
 * chef's equipment list (src/data/defaults.ts), compared without case; the
 * data layer turns a name into the chef's list value.
 */
export const EQUIPMENT = ['oven', 'combi', 'hob', 'grill', 'water bath', 'blast chiller', 'fridge', 'blender', 'mixer', 'bench'] as const;
export type EquipmentName = (typeof EQUIPMENT)[number];

/**
 * What a verb means on its own.
 * - `equipment: 'previous'` takes the equipment of the step before when it's
 *   one of `previousFrom` ("whisk in butter" after a reduction is on the hob).
 * - `minor`: an action that belongs to the step around it ("skim", "season")
 *   and never starts a step of its own.
 */
export interface VerbMeaning {
  mode: StepMode | null;
  equipment: string | null;
  previousFrom?: readonly string[];
  /** Can't be left for a ticket: cooling, emulsion. */
  pauseBlocker?: 'emulsion';
}

const m = (mode: StepMode, equipment: string | null, extra: Partial<VerbMeaning> = {}): VerbMeaning => ({ mode, equipment, ...extra });

/** Verbs that start a step. Phrases (two or three words) are matched first. */
export const VERBS: Record<string, VerbMeaning> = {
  // Oven
  roast: m('passive', 'oven'),
  bake: m('passive', 'oven'),
  'blind bake': m('passive', 'oven'),
  braise: m('passive', 'oven'),
  confit: m('passive', 'oven'),
  dehydrate: m('passive', 'oven'),
  toast: m('check-in', 'oven'),
  // Hob
  simmer: m('check-in', 'hob'),
  boil: m('check-in', 'hob'),
  'par boil': m('check-in', 'hob'),
  parboil: m('check-in', 'hob'),
  reduce: m('check-in', 'hob'),
  'cook down': m('check-in', 'hob'),
  'cook out': m('check-in', 'hob'),
  sweat: m('check-in', 'hob'),
  infuse: m('check-in', 'hob'),
  clarify: m('check-in', 'hob'),
  render: m('check-in', 'hob'),
  blanch: m('check-in', 'hob'),
  caramelise: m('check-in', 'hob'),
  caramelize: m('check-in', 'hob'),
  stew: m('check-in', 'hob'),
  cook: m('check-in', 'hob'),
  poach: m('passive', 'hob'),
  sear: m('active', 'hob'),
  fry: m('active', 'hob'),
  saute: m('active', 'hob'),
  deglaze: m('active', 'hob'),
  mount: m('active', 'hob', { pauseBlocker: 'emulsion' }),
  sabayon: m('active', 'hob', { pauseBlocker: 'emulsion' }),
  'whisk in': m('active', 'bench', { equipment: 'previous', previousFrom: ['hob'] }),
  // Grill
  char: m('active', 'grill'),
  chargrill: m('active', 'grill'),
  grill: m('active', 'grill'),
  // Blender and mixer
  blitz: m('active', 'blender'),
  blend: m('active', 'blender'),
  emulsify: m('active', 'bench', { equipment: 'previous', previousFrom: ['blender', 'mixer'], pauseBlocker: 'emulsion' }),
  whisk: m('check-in', 'mixer'),
  beat: m('active', 'mixer'),
  'beat in': m('active', 'mixer'),
  cream: m('active', 'mixer'),
  // Bench
  pass: m('active', 'bench'),
  strain: m('active', 'bench'),
  sieve: m('active', 'bench'),
  roll: m('active', 'bench'),
  cut: m('active', 'bench'),
  chop: m('active', 'bench'),
  dice: m('active', 'bench'),
  slice: m('active', 'bench'),
  julienne: m('active', 'bench'),
  brunoise: m('active', 'bench'),
  peel: m('active', 'bench'),
  trim: m('active', 'bench'),
  pick: m('active', 'bench'),
  portion: m('active', 'bench'),
  layer: m('active', 'bench'),
  pipe: m('active', 'bench'),
  scoop: m('active', 'bench'),
  rice: m('active', 'bench'),
  mix: m('active', 'bench'),
  fold: m('active', 'bench'),
  knead: m('active', 'bench'),
  shape: m('active', 'bench'),
  wrap: m('active', 'bench'),
  pod: m('active', 'bench'),
  'double pod': m('active', 'bench'),
  rinse: m('active', 'bench'),
  wash: m('active', 'bench'),
  'pat dry': m('active', 'bench'),
  'tray up': m('active', 'bench'),
  'set with': m('active', 'bench'),
  make: m('active', 'bench'),
  chuff: m('active', 'bench'),
  quenelle: m('active', 'bench'),
  spread: m('active', 'bench'),
  rub: m('active', 'bench'),
  'rub in': m('active', 'bench'),
  'bring together': m('active', 'bench'),
  grate: m('active', 'bench'),
  crumb: m('active', 'bench'),
  pane: m('active', 'bench'),
  stuff: m('active', 'bench'),
  tie: m('active', 'bench'),
  plate: m('active', 'bench'),
  // Left alone
  chill: m('passive', 'fridge'),
  'blast chill': m('passive', 'blast chiller'),
  set: m('passive', 'fridge'),
  press: m('passive', 'fridge'),
  cure: m('passive', 'fridge'),
  marinate: m('passive', 'fridge'),
  hang: m('passive', 'fridge'),
  rest: m('passive', 'bench'),
  soak: m('passive', 'bench'),
  steep: m('passive', 'bench'),
  bag: m('passive', 'bench'),
  'steam dry': m('passive', 'bench'),
  prove: m('passive', 'bench'),
  cool: m('passive', 'bench'),
  leave: m('passive', null),
  'sous vide': m('passive', 'water bath'),
};

/**
 * Actions that go with the step they're in and never start one: adding,
 * skimming, seasoning, refreshing. A piece of a line with only these joins
 * the step next to it.
 */
export const MINOR_VERBS = new Set([
  'add',
  'cover',
  'skim',
  'scrape',
  'stir',
  'season',
  'refresh',
  'pour',
  'pour over',
  'finish',
  'rain in',
  'soften',
  'freeze',
  'freeze rest',
  'freeze the rest',
  'weigh',
  'check',
  'taste',
  'adjust',
]);

/** Words that mean the equipment, whatever the verb says. */
export const EQUIPMENT_WORDS: [RegExp, string][] = [
  [/\bblast chiller\b/, 'blast chiller'],
  [/\b(water ?bath|sous vide|circulator)\b/, 'water bath'],
  [/\b(oven)\b/, 'oven'],
  [/\b(combi)\b/, 'combi'],
  [/\b(over (a )?bain( marie)?|hob|pan|stove|saucepan)\b/, 'hob'],
  [/\b(on (the )?grill|bbq|robata)\b/, 'grill'],
  [/\b(fridge|walk ?in|chiller)\b/, 'fridge'],
  [/\b(blender|thermomix|vitamix|robot coupe)\b/, 'blender'],
  [/\b(mixer|kitchenaid|kenwood|hobart)\b/, 'mixer'],
  // By hand: a bowl and a whisk, a board and a knife.
  [/\b(by hand|hand whisk|(mixing )?bowl)\b/, 'bench'],
];

/** The usual mode for a step read only from its equipment ("eggs in water bath 63c 45 min"). */
export const EQUIPMENT_MODE: Record<string, StepMode> = {
  oven: 'passive',
  combi: 'passive',
  'water bath': 'passive',
  fridge: 'passive',
  'blast chiller': 'passive',
  hob: 'check-in',
  grill: 'active',
  blender: 'active',
  mixer: 'check-in',
  bench: 'active',
};

/** Words that mean hands stay busy: "char 15 min, turning". */
export const ACTIVE_WORDS = /\b(stirring|turning|whisking|basting|constantly|by hand|hand whisk|bowl)\b/;

/** Doughs and pastry rest in the fridge, not on the bench. */
export const FRIDGE_REST_WORDS = /\b(pastry|dough|batter|paste)\b/;

/** Done to order, not in prep (SPEC → Tokens: service cue). */
export const SERVICE_CUES = /\b(to order|on order|a la minute|at service|skin side down)\b/;

/** Must follow the step before at once: "scoop while hot". */
export const NO_GAP_CUES = /\b(while (still )?(hot|warm)|straight away|immediately|chuff)\b|\bwarm\b(?! (water|milk|stock|place|plates?))/;

/**
 * Has to start the day before. Not "on the day before service": in a
 * kitchen, "on the day" means the same day.
 */
export const PREVIOUS_DAY_CUES = /(?<!\bon (the )?)\b((the )?day before|previous day|night before)\b/;

/** Clauses whose words are cues, not actions: "till just set", "before rolling". */
export const CUE_CLAUSES = /\b(till|til|until|before|dont|don't|no|should)\b.*$/;

/** Gas marks to °C. */
export const GAS_MARKS: Record<number, number> = { 1: 140, 2: 150, 3: 170, 4: 180, 5: 190, 6: 200, 7: 220, 8: 230, 9: 240 };

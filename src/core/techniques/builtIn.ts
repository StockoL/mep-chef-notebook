/**
 * What Mep ships with (SPEC → Techniques): technique names and aliases only,
 * so linking works from day one; the notes are the chef's own. Plus method
 * templates for common techniques (T3), written in the same shorthand a chef
 * would use, with typical times, so the step reader fills every chip and a
 * recipe made from one needs only corrections and a confirm.
 *
 * The times are typical estimates, not any kitchen's recipe: correct them.
 * `category` is the starting value's name in the chef's technique
 * categories list (src/data/defaults.ts); null = no category yet.
 */

export interface BuiltInTechnique {
  name: string;
  aliases: string[];
  category: string | null;
}

export const BUILT_IN_TECHNIQUES: BuiltInTechnique[] = [
  // Knife work
  { name: 'Julienne', aliases: ['allumette'], category: 'Knife work' },
  { name: 'Brunoise', aliases: [], category: 'Knife work' },
  { name: 'Chiffonade', aliases: [], category: 'Knife work' },
  { name: 'Paysanne', aliases: [], category: 'Knife work' },
  { name: 'Macédoine', aliases: [], category: 'Knife work' },
  { name: 'Jardinière', aliases: ['batonnet'], category: 'Knife work' },
  { name: 'Concassé', aliases: [], category: 'Knife work' },
  { name: 'Tourné', aliases: ['turned'], category: 'Knife work' },
  { name: 'Supreme', aliases: ['segment'], category: 'Knife work' },
  // Shaping and plating
  { name: 'Quenelle', aliases: ['rocher'], category: 'Shaping and plating' },
  { name: 'Tuile', aliases: [], category: 'Shaping and plating' },
  { name: 'Ballotine', aliases: [], category: 'Shaping and plating' },
  { name: 'Roulade', aliases: [], category: 'Shaping and plating' },
  // Preserving
  { name: 'Pickle', aliases: [], category: 'Preserving' },
  { name: 'Cure', aliases: [], category: 'Preserving' },
  { name: 'Confit', aliases: [], category: 'Preserving' },
  { name: 'Brine', aliases: [], category: 'Preserving' },
  { name: 'Ferment', aliases: ['lacto-ferment'], category: 'Preserving' },
  { name: 'Smoke', aliases: ['cold smoke', 'hot smoke'], category: 'Preserving' },
  // Sauces
  { name: 'Brown stock', aliases: ['brown chicken stock', 'veal stock'], category: 'Sauces' },
  { name: 'White stock', aliases: ['chicken stock'], category: 'Sauces' },
  { name: 'Fish stock', aliases: ['fumet'], category: 'Sauces' },
  { name: 'Reduction sauce', aliases: ['jus', 'red wine sauce'], category: 'Sauces' },
  { name: 'Beurre blanc', aliases: ['butter sauce'], category: 'Sauces' },
  { name: 'Monter au beurre', aliases: ['mount'], category: 'Sauces' },
  { name: 'Emulsion', aliases: ['emulsify'], category: 'Sauces' },
  { name: 'Sabayon', aliases: [], category: 'Sauces' },
  { name: 'Roux', aliases: [], category: 'Sauces' },
  { name: 'Liaison', aliases: [], category: 'Sauces' },
  { name: 'Beurre noisette', aliases: ['brown butter'], category: 'Sauces' },
  { name: 'Clarify', aliases: ['clarified butter'], category: 'Sauces' },
  { name: 'Nappe', aliases: [], category: 'Sauces' },
  { name: 'Deglaze', aliases: [], category: 'Sauces' },
  // Heat
  { name: 'Braise', aliases: [], category: 'Heat' },
  { name: 'Poach', aliases: [], category: 'Heat' },
  { name: 'Blanch', aliases: ['refresh'], category: 'Heat' },
  { name: 'Sear', aliases: [], category: 'Heat' },
  { name: 'Render', aliases: [], category: 'Heat' },
  { name: 'Sweat', aliases: [], category: 'Heat' },
  { name: 'Caramelise', aliases: ['caramelize'], category: 'Heat' },
  { name: 'Sous vide', aliases: ['water bath'], category: 'Heat' },
  { name: 'Purée', aliases: ['puree'], category: 'Heat' },
  { name: 'Temper', aliases: [], category: 'Heat' },
  // Doughs
  { name: 'Pasta dough', aliases: [], category: null },
  { name: 'Shortcrust pastry', aliases: ['pâte brisée', 'sweet pastry'], category: null },
];

export interface BuiltInTemplate {
  /** The technique it belongs to (BUILT_IN_TECHNIQUES → name). */
  technique: string;
  /** One method step per line, as a chef would write them. */
  steps: string[];
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    technique: 'Brown stock',
    steps: [
      'Roast bones 220c 40-45 min till dark',
      'Add mirepoix and tom puree, roast 15 more',
      'Deglaze tray with red wine, scrape 5 min',
      'Cover with cold water, bring to boil 30 min, skim',
      'Simmer 6-8 hrs, skim every hour',
      'Pass through chinois 15 min',
      'Blast chill, under 8c within 90 min',
    ],
  },
  {
    technique: 'White stock',
    steps: [
      'Cover bones with cold water, bring to boil 30 min, skim',
      'Add mirepoix, simmer 3-4 hrs, skim every 30 min',
      'Pass through chinois 15 min',
      'Blast chill, under 8c within 90 min',
    ],
  },
  {
    technique: 'Fish stock',
    steps: [
      'Sweat onion, fennel and celery 10 min no colour',
      'Add bones and white wine, cover with water, simmer 20 min',
      'Pass through muslin 10 min',
      'Blast chill, under 8c within 90 min',
    ],
  },
  {
    technique: 'Braise',
    steps: [
      'Season and sear meat 10-15 min',
      'Sweat mirepoix 10 min',
      'Deglaze with red wine 5 min, reduce by half 15 min',
      'Add stock, cover, braise 160c 3-4 hrs',
      'Rest in the liquor 30 min',
      'Pass and reduce the liquor 20-30 min',
    ],
  },
  {
    technique: 'Reduction sauce',
    steps: [
      'Sweat shallots in butter 10 min no colour',
      'Add red wine and port, reduce to a syrup 20-30 min',
      'Add stock, reduce by 2/3, 45 min-1h',
      'Pass through chinois 5 min',
      'Mount with cold butter to order',
    ],
  },
  {
    technique: 'Beurre blanc',
    steps: ['Reduce shallot, white wine and vinegar 10 min', 'Whisk in cold butter 5-10 min', 'Hold warm max 2 hrs'],
  },
  {
    technique: 'Pickle',
    steps: ['Slice the veg 15 min', 'Boil vinegar, sugar and water 5 min', 'Pour over the veg, leave overnight'],
  },
  {
    technique: 'Purée',
    steps: [
      'Sweat the veg in butter 10 min',
      'Add milk or stock, simmer till tender 20-30 min',
      'Blitz 3-5 min',
      'Pass through a fine sieve 10 min',
      'Chill in fridge min 1 hr',
    ],
  },
  {
    technique: 'Pasta dough',
    steps: ['Mix flour and eggs 5 min', 'Knead 10 min', 'Rest in fridge 30 min', 'Roll and cut 15-20 min'],
  },
  {
    technique: 'Shortcrust pastry',
    steps: [
      'Rub butter into flour 5 min',
      'Bring together with cold water 5 min',
      'Rest in fridge min 1 hr',
      'Roll and line the tin 15 min',
      'Blind bake 170c 20 min with beans, then 5-10 without',
    ],
  },
  {
    technique: 'Confit',
    steps: ['Cure in salt 12 hrs', 'Rinse and pat dry 10 min', 'Confit in fat 120c 2-3 hrs', 'Cool in the fat 1 hr, chill 2 hrs'],
  },
];

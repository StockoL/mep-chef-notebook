/**
 * Reads an ingredient list written in kitchen shorthand (R1):
 *   "bones 2kg, mirepoix, tom puree 1 tbsp, thyme 3 sprigs, bay"
 * into rows of { name, quantity, unit, prepNote }. Items are separated by
 * new lines or commas; quantity can come before or after the name; a note in
 * brackets is the prep note: "shallots 200g (brunoise)".
 * Pure: matching names to ingredients and components happens in src/data.
 */

import { formatQuantity, type Unit } from '../units/units';

export interface ShorthandLine {
  name: string;
  quantity: number | null;
  unit: Unit | null;
  prepNote: string;
}

/** Every way a chef might write each unit. Longest first so "kg" wins over "g". */
const UNIT_WORDS: [Unit, string[]][] = [
  ['kg', ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms']],
  ['g', ['g', 'gr', 'grm', 'gram', 'grams', 'gramme', 'grammes']],
  ['ml', ['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters']],
  ['l', ['l', 'lt', 'ltr', 'ltrs', 'litre', 'litres', 'liter', 'liters']],
  ['pint', ['pint', 'pints', 'pt', 'pts']],
  ['tsp', ['tsp', 'tsps', 'teaspoon', 'teaspoons']],
  ['tbsp', ['tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons']],
  ['pinch', ['pinch', 'pinches']],
  ['bunch', ['bunch', 'bunches', 'bn']],
  ['sprig', ['sprig', 'sprigs']],
  ['clove', ['clove', 'cloves']],
  ['slice', ['slice', 'slices']],
  ['sheet', ['sheet', 'sheets']],
  ['leaf', ['leaf', 'leaves']],
  ['tin', ['tin', 'tins', 'can', 'cans']],
  ['pack', ['pack', 'packs', 'pkt', 'packet', 'packets']],
  ['dash', ['dash', 'dashes']],
  ['splash', ['splash', 'splashes']],
  ['handful', ['handful', 'handfuls']],
  ['knob', ['knob', 'knobs']],
  ['portion', ['portion', 'portions', 'ptn', 'ptns']],
  ['each', ['each', 'ea', 'x']],
];

const UNIT_BY_WORD = new Map(UNIT_WORDS.flatMap(([unit, words]) => words.map((word) => [word, unit] as const)));

/**
 * Units that mean "one" when written without a number: "turmeric pinch",
 * "pinch of salt", "half pint lager". Not leaf, clove, slice or sheet: those
 * are often part of the name ("bay leaf", "garlic clove").
 */
const UNITS_WITHOUT_NUMBER = new Set<Unit>(['pint', 'tsp', 'tbsp', 'pinch', 'bunch', 'sprig', 'dash', 'splash', 'handful', 'knob']);
const AMOUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, half: 0.5, 'half a': 0.5 };
const AMOUNT = String.raw`(?:(a|an|one|half a|half)\s+)?`;

/** Centilitres are written but not kept: 5cl → 50ml. */
const SCALED_UNITS: Record<string, { unit: Unit; factor: number }> = {
  cl: { unit: 'ml', factor: 10 },
  dl: { unit: 'ml', factor: 100 },
};

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

/** A number as a chef writes it: 2, 1.5, 1,5, ½, 1½, 1/2. */
const NUMBER = String.raw`(?:\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛]|\d+\/\d+)`;

/** Splits on new lines and on commas, but not commas inside brackets or numbers (1,5kg). */
export function splitItems(text: string): string[] {
  const items: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    const isDecimalComma = char === ',' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '');
    if (char === '\n' || (char === ',' && depth === 0 && !isDecimalComma)) {
      items.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  items.push(current);
  return items.map((item) => item.trim()).filter(Boolean);
}

export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/\s+/g, '').replace(',', '.');
  if (cleaned.includes('/')) {
    const [top, bottom] = cleaned.split('/').map(Number);
    return top !== undefined && bottom ? top / bottom : null;
  }
  const fraction = Object.keys(FRACTIONS).find((f) => cleaned.endsWith(f));
  if (fraction) {
    const whole = cleaned.slice(0, -fraction.length);
    return (whole ? Number(whole) : 0) + FRACTIONS[fraction]!;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Reads one item: "bones 2kg", "2 kg bones", "3 eggs", "thyme", "shallots 200g (brunoise)". */
export function parseItem(item: string): ShorthandLine {
  let text = item.trim();
  let prepNote = '';

  // 1. A note in brackets at the end is the prep note.
  const bracket = /\(([^)]*)\)\s*$/.exec(text);
  if (bracket) {
    prepNote = bracket[1]!.trim();
    text = text.slice(0, bracket.index).trim();
  }

  // A quantity on its own ("2kg") has no name: nothing to keep.
  const bare = new RegExp(String.raw`^(${NUMBER})\s*([a-zA-Z]*)$`).exec(text);
  if (bare && (!bare[2] || readUnit(1, bare[2]))) return { name: '', quantity: null, unit: null, prepNote };

  // 2. Quantity at the end: "bones 2kg", "thyme 3 sprigs", "bay leaves 2".
  const atEnd = new RegExp(String.raw`^(.*\S)\s+(${NUMBER})\s*([a-zA-Z]+)?$`).exec(text);
  if (atEnd) {
    const quantity = parseNumber(atEnd[2]!);
    const read = quantity === null ? null : readUnit(quantity, atEnd[3]);
    if (read) return { name: tidy(atEnd[1]!), ...read, prepNote };
  }

  // 3. Quantity at the start: "2kg bones", "3 eggs", "3 large eggs".
  const atStart = new RegExp(String.raw`^(${NUMBER})\s*([a-zA-Z]+)?\s+(.+)$`).exec(text);
  if (atStart) {
    const quantity = parseNumber(atStart[1]!);
    if (quantity !== null) {
      const read = readUnit(quantity, atStart[2]);
      // A word after the number that isn't a unit belongs to the name: "3 large eggs".
      if (read) return { name: tidy(atStart[3]!), ...read, prepNote };
      return { name: tidy(`${atStart[2]} ${atStart[3]}`), quantity, unit: 'each', prepNote };
    }
  }

  // 4. A unit with no number: "turmeric pinch", "pinch of salt", "lager half pint".
  const unitOnly = readUnitWithoutNumber(text);
  if (unitOnly) return { ...unitOnly, prepNote };

  // 5. No quantity: "mirepoix", "tom puree".
  return { name: tidy(text), quantity: null, unit: null, prepNote };
}

/** The unit after a number: none means a count; an unknown word means it isn't a unit. */
function readUnit(quantity: number, word: string | undefined): { quantity: number; unit: Unit } | null {
  if (!word) return { quantity, unit: 'each' };
  const lower = word.toLowerCase();
  const scaled = SCALED_UNITS[lower];
  if (scaled) return { quantity: quantity * scaled.factor, unit: scaled.unit };
  const unit = UNIT_BY_WORD.get(lower);
  return unit ? { quantity, unit } : null;
}

function readUnitWithoutNumber(text: string): Omit<ShorthandLine, 'prepNote'> | null {
  const amountOf = (word: string | undefined) => (word ? (AMOUNT_WORDS[word.toLowerCase()] ?? 1) : 1);
  const unitFor = (word: string) => {
    const unit = UNIT_BY_WORD.get(word.toLowerCase());
    return unit && UNITS_WITHOUT_NUMBER.has(unit) ? unit : null;
  };
  const atStart = new RegExp(String.raw`^${AMOUNT}([a-zA-Z]+)(?:\s+of)?\s+(.+)$`, 'i').exec(text);
  if (atStart) {
    const unit = unitFor(atStart[2]!);
    if (unit) return { name: tidy(atStart[3]!), quantity: amountOf(atStart[1]), unit };
  }
  const atEnd = new RegExp(String.raw`^(.*?\S)\s+${AMOUNT}([a-zA-Z]+)$`, 'i').exec(text);
  if (atEnd) {
    const unit = unitFor(atEnd[3]!);
    if (unit) return { name: tidy(atEnd[1]!), quantity: amountOf(atEnd[2]), unit };
  }
  return null;
}

/** The whole text box → rows. Items with no name ("2kg" on its own) are dropped. */
export function parseShorthand(text: string): ShorthandLine[] {
  return splitItems(text)
    .map(parseItem)
    .filter((line) => line.name.length > 0);
}

/** One row back to shorthand: "bones 2kg (roasted)". */
export function formatShorthand(line: { name: string; quantity: number | null; unit: string | null; prepNote: string }): string {
  const quantity = line.quantity !== null ? ` ${formatQuantity(line.quantity, line.unit ?? 'each')}` : '';
  const note = line.prepNote ? ` (${line.prepNote})` : '';
  return `${line.name}${quantity}${note}`;
}

function tidy(name: string): string {
  return name.replace(/\s+/g, ' ').replace(/^[-–•*]\s*/, '').trim();
}

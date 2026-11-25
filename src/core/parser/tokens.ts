/**
 * Readers for the measured parts of a step: times, temperatures, holds and
 * "every hour". Each takes normalised text and returns what it found plus
 * the text with that part blanked out, so the next reader doesn't read the
 * same words twice ("gas 6 1hr": the 6 is a gas mark, not a time).
 */

import { GAS_MARKS } from './words';

/** Minutes, with max null for "at least min" ("chill min 2 hrs", "overnight"). */
export interface Minutes {
  min: number;
  max: number | null;
}

export interface Found<T> {
  value: T | null;
  rest: string;
}

/**
 * Lower case, no accents, fractions as decimals, and kitchen shorthand
 * spelt out: "w/" → "with", "thru" → "through", "1 1/2" → "1.5", "2½" → "2.5".
 */
export function normaliseStepText(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/(\d)\s*½/g, '$1.5')
      .replace(/(\d)\s*¼/g, '$1.25')
      .replace(/(\d)\s*¾/g, '$1.75')
      .replace(/½/g, '0.5')
      .replace(/¼/g, '0.25')
      .replace(/¾/g, '0.75')
      .replace(/\b(\d+)\s+1\/2\b/g, (_, n: string) => `${Number(n) + 0.5}`)
      .replace(/\b(\d+)\s+1\/4\b/g, (_, n: string) => `${Number(n) + 0.25}`)
      .replace(/\b(\d+)\s+3\/4\b/g, (_, n: string) => `${Number(n) + 0.75}`)
      .replace(/[–—]/g, '-')
      .replace(/\bw\//g, 'with ')
      .replace(/\bw\/o\b/g, 'without')
      .replace(/\bthru\b/g, 'through')
      .replace(/\b(\d+)\s*-\s*(?=\d)/g, '$1-')
      .replace(/[()!]/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim()
  );
}

const blank = (text: string, match: RegExpMatchArray) =>
  text.slice(0, match.index) + ' '.repeat(match[0].length) + text.slice((match.index ?? 0) + match[0].length);

// ─── Time ─────────────────────────────────────────────────────────────────

const NUM = String.raw`\d+(?:\.\d+)?`;
const UNIT = String.raw`(?:seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)`;
/** One time: "45 min", "1hr", "1h15", "90 sec", or a bare number (unit from its partner). */
const TERM = String.raw`(${NUM})\s*(${UNIT})?(?:\s*(\d{1,2})(?!\d))?`;
const RANGE = new RegExp(String.raw`(?<![\d.:/])${TERM}(?:\s*(?:-|to)\s*${TERM})?(\s*\+)?(?![a-z\d/:])`, 'g');

function unitMinutes(unit: string): number {
  if (/^s/.test(unit)) return 1 / 60;
  if (/^h/.test(unit)) return 60;
  if (/^d/.test(unit)) return 1440;
  return 1;
}

function termMinutes(amount: string, unit: string, extraMinutes: string | undefined): number {
  const value = Number(amount) * unitMinutes(unit) + (extraMinutes && /^h/.test(unit) ? Number(extraMinutes) : 0);
  return Math.round(value * 100) / 100;
}

/**
 * The first time in the text: "40-45 min", "6-8 hrs", "45 min-1h",
 * "1hr-1h15", "1 hr+", "min 2 hrs", "overnight". A time needs a unit
 * somewhere, so "2/3", "3:2:1" and "00 flour" are left alone.
 */
export function readMinutes(text: string): Found<Minutes> {
  const overnight = text.match(/\b(overnight|over night)\b/);
  const atLeast = /(?<![\d.]\s*)\b(min|minimum|at least)\s+(?=\d)/;
  let working = text;
  let openEnded = false;
  const atLeastMatch = working.match(atLeast);
  if (atLeastMatch) {
    working = blank(working, atLeastMatch);
    openEnded = true;
  }

  for (const match of working.matchAll(RANGE)) {
    const [, a, aUnit, aExtra, b, bUnit, bExtra, plus] = match;
    if (!aUnit && !bUnit) continue;
    // "40-45 min": the first number borrows the second's unit.
    const min = termMinutes(a!, aUnit ?? bUnit!, aExtra);
    const max = b ? termMinutes(b, bUnit ?? aUnit!, bExtra) : min;
    // "45 min" read from "min 2 hrs" can't happen: the "min" was blanked above.
    const open = openEnded || Boolean(plus);
    return { value: { min, max: open ? null : max }, rest: blank(working, match) };
  }
  if (overnight) return { value: { min: 480, max: null }, rest: blank(text, overnight) };
  return { value: null, rest: text };
}

/**
 * A time that runs on from the step before: "roast 15 more", "another 10 min",
 * or a piece starting "then 5-10". Minutes unless a unit says otherwise.
 */
export function readRelativeMinutes(text: string, startsWithThen: boolean): Found<Minutes> {
  const more = text.match(new RegExp(String.raw`\b(?:another\s+)?(${NUM})(?:-(${NUM}))?\s*(${UNIT})?\s+more\b|\banother\s+(${NUM})(?:-(${NUM}))?\s*(${UNIT})?(?![a-z])`));
  if (more) {
    const [, a, b, unit, a2, b2, unit2] = more;
    const perUnit = unitMinutes(unit ?? unit2 ?? 'min');
    const min = Number(a ?? a2) * perUnit;
    const max = b ?? b2 ? Number(b ?? b2) * perUnit : min;
    return { value: { min, max }, rest: blank(text, more) };
  }
  if (startsWithThen) {
    const bare = text.match(new RegExp(String.raw`^\s*then\s+(${NUM})(?:-(${NUM}))?(?!\s*(?:°|c\b|f\b|g\b|kg|ml|l\b|cm|mm|%|x\b))`));
    if (bare) {
      const min = Number(bare[1]);
      return { value: { min, max: bare[2] ? Number(bare[2]) : min }, rest: blank(text, bare) };
    }
  }
  return { value: null, rest: text };
}

/** "skim every hour" → 60, "every 10 min" → 10, "hourly" → 60. */
export function readCheckEvery(text: string): Found<number> {
  const match = text.match(new RegExp(String.raw`\b(?:every|each)\s+(?:(${NUM})\s*(${UNIT})|(half hour|hour|hr)|(few minutes|few mins))\b|\bhourly\b`));
  if (!match) return { value: null, rest: text };
  const [, amount, unit, hour, few] = match;
  let minutes = 60;
  if (amount && unit) minutes = Number(amount) * unitMinutes(unit);
  else if (hour === 'half hour') minutes = 30;
  else if (few) minutes = 5;
  return { value: minutes, rest: blank(text, match) };
}

// ─── Temperature ──────────────────────────────────────────────────────────

/**
 * An oven, bath or pan setting: "220c", "180°C", "160 fan", "fan 160",
 * "gas 6", "425F", or a heat word ("low"). Gas and °F become °C.
 */
export function readSetting(text: string): Found<string> {
  const gas = text.match(/\bgas(?:\s*mark)?\s*(\d)\b|\bgm\s*(\d)\b/);
  if (gas) {
    const celsius = GAS_MARKS[Number(gas[1] ?? gas[2])];
    if (celsius) return { value: `${celsius}°C`, rest: blank(text, gas) };
  }
  const fan = text.match(/\b(\d{2,3})\s*°?\s*c?\s*fan\b|\bfan\s*(\d{2,3})\b/);
  if (fan) return { value: `${fan[1] ?? fan[2]}°C fan`, rest: blank(text, fan) };

  const fahrenheit = text.match(/\b(\d{2,3})\s*°?\s*f\b/);
  if (fahrenheit) return { value: `${fahrenheitToCelsius(Number(fahrenheit[1]))}°C`, rest: blank(text, fahrenheit) };

  const celsius = text.match(/\b(\d{1,3}(?:\.\d)?)\s*(?:°\s*c?|c)\b/);
  if (celsius) return { value: `${Number(celsius[1])}°C`, rest: blank(text, celsius) };

  // "roast at 180 for 25 min": a bare number after "at" is °C.
  const bare = text.match(/\bat (\d{2,3})\b(?!\s*(?:g|kg|ml|l|cm|mm|%|x)\b|\.\d)/);
  if (bare) return { value: `${Number(bare[1])}°C`, rest: blank(text, bare) };

  const heat = text.match(/\b(low|medium|med|high)( heat)?\b/);
  if (heat) return { value: heat[1] === 'med' ? 'medium' : heat[1]!, rest: blank(text, heat) };

  return { value: null, rest: text };
}

/** 425°F → 220°C: oven temperatures round to the nearest 10, lower ones to the degree. */
export function fahrenheitToCelsius(f: number): number {
  const c = ((f - 32) * 5) / 9;
  return c >= 100 ? Math.round(c / 10) * 10 : Math.round(c);
}

// ─── Holds ────────────────────────────────────────────────────────────────

export interface HoldReading {
  minutes: number;
  /** "fridge", "freezer" or "warm". */
  where: string;
}

/** "holds 3 days in walk-in", "keeps 2 days", "hold warm max 2 hrs". */
export function readHold(text: string): Found<HoldReading> {
  const warm = text.match(new RegExp(String.raw`\b(?:hold|keep)\s+(warm|hot)\s+(?:for\s+)?(?:max\s+|maximum\s+|up to\s+)?(${NUM})\s*(${UNIT})\b`));
  if (warm) return { value: { minutes: Number(warm[2]) * unitMinutes(warm[3]!), where: 'warm' }, rest: blank(text, warm) };

  const cold = text.match(
    new RegExp(String.raw`\b(?:holds?|keeps?)\s+(?:for\s+)?(?:up to\s+)?(${NUM})\s*(weeks?|${UNIT})\b(?:\s+in\s+(?:the\s+)?(walk ?-?in|fridge|freezer))?`),
  );
  if (cold) {
    const unit = cold[2]!;
    const minutes = Number(cold[1]) * (unit.startsWith('w') ? 7 * 1440 : unitMinutes(unit));
    return { value: { minutes, where: cold[3] === 'freezer' ? 'freezer' : 'fridge' }, rest: blank(text, cold) };
  }
  return { value: null, rest: text };
}

/**
 * A time the chef types to correct a step: "45", "40-45", "2+" are minutes;
 * anything else is read as in a step ("1h30", "6-8 hrs", "overnight").
 */
export function readTypedMinutes(typed: string): Minutes | null {
  const text = normaliseStepText(typed);
  const bare = text.match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(\+)?$/);
  if (bare) {
    const min = Number(bare[1]);
    if (bare[3]) return { min, max: null };
    const max = bare[2] ? Number(bare[2]) : min;
    return max >= min ? { min, max } : { min: max, max: min };
  }
  return readMinutes(text).value;
}

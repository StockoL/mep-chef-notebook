/**
 * The step reader (SPEC → Step language and parser; DECISIONS 3, 38).
 *
 * Reads one line of a method, as a chef writes it, into one or more parts:
 * "Apricots, sugar, vinegar, cook down 20 min, blend, pass" is three parts
 * (cook down · hob · 20 min | blend · blender | pass · bench). The line itself
 * is never changed; the parts are what the planner will schedule.
 *
 * How it reads a line:
 * 1. Pull out what belongs to the whole line: holds ("holds 3 days"),
 *    hot holding, "the day before".
 * 2. Split it at commas, full stops, " - " and "then".
 * 3. Read each piece: its verb (from the chef's word list first, then the
 *    built-in one), equipment words, setting, time, and cues.
 * 4. A piece with a main verb starts a part; pieces without one (ingredients,
 *    "skim", "season") join the part next to them.
 * 5. Neighbouring parts that are the same kind of work with no times
 *    ("rinse, pat dry, portion") become one.
 * 6. Finish each part: defaults for anything still open, then the flags.
 *
 * Pure: no database, no DOM. The data layer turns equipment names and
 * component names into the chef's records.
 */

import { readCheckEvery, readHold, readMinutes, readRelativeMinutes, readSetting, normaliseStepText, type HoldReading, type Minutes } from './tokens';
import {
  ACTIVE_WORDS,
  CUE_CLAUSES,
  EQUIPMENT_MODE,
  EQUIPMENT_WORDS,
  FRIDGE_REST_WORDS,
  MINOR_VERBS,
  NO_GAP_CUES,
  PREVIOUS_DAY_CUES,
  SERVICE_CUES,
  VERBS,
  type VerbMeaning,
} from './words';

/** The three step modes. Fixed by the app (DECISIONS 4 and 16). */
export const STEP_MODES = ['active', 'check-in', 'passive'] as const;
export type StepMode = (typeof STEP_MODES)[number];

export type CriticalPoint = 'cooling' | 'hot-hold' | 'reheat';

/** What the reader got from one part of a line. null = couldn't tell (an empty chip). */
export interface ReadPart {
  /** The words of the line this part came from. */
  text: string;
  /** The word that set the mode and equipment: what a correction teaches. */
  verb: string | null;
  mode: StepMode | null;
  minutes: Minutes | null;
  /** An equipment name: one of EQUIPMENT, or a word from the chef's list. */
  equipment: string | null;
  /** "220°C", "160°C fan", "low". */
  setting: string | null;
  /** "skim every hour" → 60. */
  checkEvery: number | null;
  /** Components named with @ ("@brown stock"), as written. */
  dependsOn: string[];
  /** "then as brown stock": follows another recipe's method. */
  templateRef: string | null;
  hold: HoldReading | null;
  critical: CriticalPoint | null;
  /** false when it can't be left for a ticket; pauseBlocker says why. */
  pausable: boolean;
  pauseBlocker: 'cooling' | 'emulsion' | 'hot-hold' | null;
  /** Done at service ("to order"): left out of prep. */
  atService: boolean;
  /** Its time runs on from the step before ("roast 15 more"). */
  relativeTime: boolean;
  /** Must follow the step before at once ("while hot"). */
  noGap: boolean;
  /** Starts the day before. */
  previousDay: boolean;
}

/** One of the chef's corrections: this word means this mode or equipment. */
export interface ChefWord {
  word: string;
  mode: StepMode | null;
  equipment: string | null;
}

export interface ReadOptions {
  /** The chef's word list, applied over the built-in verbs. */
  words?: readonly ChefWord[];
  /** The last part of the step before: for "15 more" and "whisk in". */
  previous?: ReadPart | null;
  /**
   * The kitchen's equipment list: a name written in a step ("in the Pacojet",
   * "mixing bowl") is that equipment, whatever the verb says.
   */
  equipmentNames?: readonly string[];
}

/** The flags the test set and the chips use. */
export type StepFlag = 'needs-estimate' | 'service' | 'relative-time' | 'no-gap' | 'template-ref' | 'previous-day';

export function partFlags(part: ReadPart): StepFlag[] {
  const flags: StepFlag[] = [];
  if (needsEstimate(part)) flags.push('needs-estimate');
  if (part.atService) flags.push('service');
  if (part.relativeTime) flags.push('relative-time');
  if (part.noGap) flags.push('no-gap');
  if (part.templateRef) flags.push('template-ref');
  if (part.previousDay) flags.push('previous-day');
  return flags;
}

/** A part that's only a hold ("holds 3 days in walk-in") isn't work to schedule. */
export function isHoldOnly(part: Pick<ReadPart, 'mode' | 'hold' | 'minutes'>): boolean {
  return part.mode === null && part.hold !== null && part.minutes === null;
}

function needsEstimate(part: ReadPart): boolean {
  return part.minutes === null && !isHoldOnly(part);
}

// ─── Reading a line ───────────────────────────────────────────────────────

/** Reads one line of a method into its parts. An empty line has none. */
export function readStep(line: string, options: ReadOptions = {}): ReadPart[] {
  const original = line.trim();
  if (!original) return [];
  let text = normaliseStepText(original);

  // 1. What belongs to the whole line.
  const hold = readHold(text);
  text = hold.rest;
  const hotHold = hold.value?.where === 'warm';
  const dayBefore = PREVIOUS_DAY_CUES.test(text);
  text = text.replace(PREVIOUS_DAY_CUES, (match) => `<day> ${' '.repeat(Math.max(0, match.length - 6))}`);

  // 2–3. Split and read each piece.
  const pieces = splitPieces(text).map((piece) => readPiece(piece, options.words ?? [], options.equipmentNames ?? []));
  if (pieces.length === 0) {
    return hold.value ? [holdOnlyPart(original, hold.value)] : [];
  }

  // 4. Group pieces into parts.
  const groups: Piece[][] = [];
  let pending: Piece[] = [];
  for (const piece of pieces) {
    const current = groups.at(-1);
    const startsPart = piece.verb !== null || (piece.relative !== null && (piece.startsWithThen || Boolean(current?.some((p) => p.minutes))));
    if (startsPart) {
      groups.push([...pending, piece]);
      pending = [];
    } else if (current) {
      current.push(piece);
    } else {
      pending.push(piece);
    }
  }
  if (pending.length) {
    // Nothing with a verb: a hold on its own, or a part read from equipment and time alone.
    const onlyHold = hold.value && pending.every((p) => !p.minutes && !p.relative);
    if (groups.length === 0 && onlyHold) return [holdOnlyPart(original, hold.value!)];
    if (groups.length) groups.at(-1)!.push(...pending);
    else groups.push(pending);
  }

  // 5–6. Build each part, then join neighbours that are the same work.
  let previous = options.previous ?? null;
  let parts: ReadPart[] = [];
  for (const group of groups) {
    const part = buildPart(group, previous);
    parts.push(part);
    previous = part;
  }
  parts = joinAlike(parts);

  // Line-level readings go on the last part (holding comes after the work).
  const last = parts.at(-1)!;
  if (hold.value) last.hold = hold.value;
  if (hotHold) {
    last.critical = 'hot-hold';
    last.pausable = false;
    last.pauseBlocker = 'hot-hold';
  }

  // The day before: the part that says so starts the day before, and a rest
  // after it with no time is overnight. Otherwise, anything left 8 hours or
  // more starts the day before.
  if (dayBefore) {
    const index = Math.max(
      0,
      groups.findIndex((g) => g.some((p) => p.dayBefore)),
    );
    parts[Math.min(index, parts.length - 1)]!.previousDay = true;
    for (const part of parts.slice(index + 1)) {
      if (part.mode === 'passive' && !part.minutes) {
        part.minutes = { min: 480, max: null };
        if (part.equipment === 'bench') part.equipment = 'fridge';
      }
    }
  } else {
    for (const part of parts) {
      if (part.mode === 'passive' && part.minutes && part.minutes.min >= 480) part.previousDay = true;
    }
  }

  // Each part's text: the words of the line it came from, as written.
  // (A piece that was only a hold, "Hold warm max 2 hrs", has no part of its own.)
  const originalPieces = splitPieces(original.replace(/\s+/g, ' '), true).filter((piece) => {
    const left = readHold(normaliseStepText(piece)).rest.replace(PREVIOUS_DAY_CUES, '');
    return /[a-z0-9@]/.test(left);
  });
  if (parts.length === 1) parts[0]!.text = original;
  else if (originalPieces.length === pieces.length) {
    let i = 0;
    const texts: string[][] = groups.map((g) => g.map(() => originalPieces[i++] ?? ''));
    // joinAlike may have merged groups; rebuild from the parts' piece counts.
    let cursor = 0;
    for (const part of parts) {
      const count = part.text.split('\u0000').length;
      part.text = texts
        .flat()
        .slice(cursor, cursor + count)
        .join(', ');
      cursor += count;
    }
  } else {
    for (const part of parts) part.text = part.text.replaceAll('\u0000', ', ');
  }
  return parts;
}

/** Reads a whole method: each line sees the last part of the line before. */
export function readMethod(lines: readonly string[], options: Omit<ReadOptions, 'previous'> = {}): ReadPart[][] {
  let previous: ReadPart | null = null;
  return lines.map((line) => {
    const parts = readStep(line, { ...options, previous });
    previous = parts.at(-1) ?? previous;
    return parts;
  });
}

function holdOnlyPart(text: string, hold: HoldReading): ReadPart {
  return { ...emptyPart(text), hold };
}

function emptyPart(text: string): ReadPart {
  return {
    text,
    verb: null,
    mode: null,
    minutes: null,
    equipment: null,
    setting: null,
    checkEvery: null,
    dependsOn: [],
    templateRef: null,
    hold: null,
    critical: null,
    pausable: true,
    pauseBlocker: null,
    atService: false,
    relativeTime: false,
    noGap: false,
    previousDay: false,
  };
}

// ─── Pieces ───────────────────────────────────────────────────────────────

/**
 * Splits at commas, semicolons, full stops, " - " and before "then".
 * `keepCase` splits the original text the same way, for the parts' wording.
 */
function splitPieces(text: string, keepCase = false): string[] {
  const thenSplit = keepCase ? /\s+(?=then\b)/i : /\s+(?=then\b)/;
  return text
    .split(/[,;]|\.(?=\s|$)|\s-\s/)
    .flatMap((piece) => piece.split(thenSplit))
    .map((piece) => piece.trim())
    .filter((piece) => piece.replace(/<day>/g, '').trim().length > 0 && /[a-z0-9@]/i.test(piece));
}

interface Piece {
  text: string;
  verb: string | null;
  meaning: VerbMeaning | null;
  equipmentWord: string | null;
  minutes: Minutes | null;
  relative: Minutes | null;
  startsWithThen: boolean;
  setting: string | null;
  checkEvery: number | null;
  dependsOn: string[];
  templateRef: string | null;
  service: boolean;
  noGap: boolean;
  activeWord: boolean;
  dayBefore: boolean;
  cooling: boolean;
  reheat: boolean;
  fridgeRest: boolean;
}

function readPiece(raw: string, words: readonly ChefWord[], equipmentNames: readonly string[]): Piece {
  let text = raw;
  const dayBefore = text.includes('<day>');
  text = text.replace(/<day>/g, ' ');
  const startsWithThen = /^then\b/.test(text);

  // Component references: "@brown stock".
  const dependsOn: string[] = [];
  text = text.replace(/@([a-z][a-z' ]*?)(?=\s*$|\s+\d|\s+(?:and|then|with|for|in|on|at|to|until|till|by)\b)/g, (_, name: string) => {
    dependsOn.push(capitalise(name.trim()));
    return ' ';
  });

  // Another recipe's method: "then as brown stock", "as for chicken stock".
  let templateRef: string | null = null;
  const template = text.match(/\b(?:then\s+as|as\s+for|as\s+per|same\s+as)\s+@?([a-z][a-z ]*[a-z])/);
  if (template) {
    templateRef = capitalise(template[1]!);
    text = text.replace(template[0], ' ');
  }

  const checkEvery = readCheckEvery(text);
  text = checkEvery.rest;
  const setting = readSetting(text);
  text = setting.rest;
  const relative = readRelativeMinutes(text, startsWithThen);
  text = relative.rest;
  const minutes = relative.value ? { value: null, rest: text } : readMinutes(text);
  text = minutes.rest;

  // The verb: the chef's words first, then the built-in ones; never inside a cue clause.
  const actionText = text.replace(CUE_CLAUSES, ' ').replace(/\s+/g, ' ').trim();
  const found = findVerb(actionText, words);

  // The kitchen's own equipment first (longest name first), then the built-in words.
  let equipmentWord: string | null = null;
  const padded = ` ${text.replace(/[^a-z0-9]+/g, ' ')} `;
  for (const name of [...equipmentNames].sort((a, b) => b.length - a.length)) {
    const wanted = normaliseStepText(name).replace(/[^a-z0-9]+/g, ' ').trim();
    if (wanted && (padded.includes(` ${wanted} `) || padded.includes(` ${wanted}s `))) {
      equipmentWord = name;
      break;
    }
  }
  if (!equipmentWord) {
    for (const [pattern, name] of EQUIPMENT_WORDS) {
      if (pattern.test(text)) {
        equipmentWord = name;
        break;
      }
    }
  }

  return {
    text: raw,
    verb: found?.verb ?? null,
    meaning: found?.meaning ?? null,
    equipmentWord,
    minutes: minutes.value,
    relative: relative.value,
    startsWithThen,
    setting: setting.value,
    checkEvery: checkEvery.value,
    dependsOn,
    templateRef,
    service: SERVICE_CUES.test(text),
    noGap: NO_GAP_CUES.test(text),
    activeWord: ACTIVE_WORDS.test(text),
    dayBefore,
    cooling: /\bblast chill/.test(raw) || /\b(chill|cool)(ed)?\s+(to|below|under)\b/.test(text),
    reheat: /\b(reheat|regenerate|regen)/.test(raw),
    fridgeRest: FRIDGE_REST_WORDS.test(raw),
  };
}

/** The first main verb in the text (longest phrase first), or null. */
function findVerb(text: string, words: readonly ChefWord[]): { verb: string; meaning: VerbMeaning } | null {
  const tokens = text.split(/[^a-z0-9']+/).filter(Boolean);
  const chef = new Map(words.map((w) => [normaliseStepText(w.word), w]));
  let i = 0;
  tokens: while (i < tokens.length) {
    for (const length of [3, 2, 1]) {
      if (tokens.length - i < length) continue;
      const phrase = tokens.slice(i, i + length).join(' ');
      const own = chef.get(phrase) ?? chef.get(singularVerb(phrase));
      const builtIn = VERBS[phrase] ?? VERBS[singularVerb(phrase)];
      if (own && (own.mode || own.equipment)) {
        const meaning: VerbMeaning = {
          ...(builtIn ?? { mode: null, equipment: null }),
          mode: own.mode ?? builtIn?.mode ?? null,
          equipment: own.equipment ?? builtIn?.equipment ?? null,
        };
        // The chef's own equipment is meant as written, not taken from the step before.
        if (own.equipment) delete meaning.previousFrom;
        return { verb: phrase, meaning };
      }
      // A minor action ("pour over", "freeze the rest") is skipped whole.
      if (MINOR_VERBS.has(phrase)) {
        i += length;
        continue tokens;
      }
      if (builtIn) return { verb: VERBS[phrase] ? phrase : singularVerb(phrase), meaning: builtIn };
    }
    i++;
  }
  return null;
}

/** "roasts", "roasted", "roasting" → "roast": enough for verbs written loosely. */
function singularVerb(word: string): string {
  const candidates: string[] = [];
  if (word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    candidates.push(stem, `${stem}e`, stem.slice(0, -1)); // "roasting", "proving", "chopping"
  }
  if (word.endsWith('ed')) candidates.push(word.slice(0, -2), word.slice(0, -1), word.slice(0, -3));
  if (word.endsWith('s')) candidates.push(word.slice(0, -1));
  return candidates.find((c) => VERBS[c]) ?? word;
}

function capitalise(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─── Building a part ──────────────────────────────────────────────────────

function buildPart(group: Piece[], previous: ReadPart | null): ReadPart {
  const part = emptyPart(group.map((p) => p.text).join('\u0000'));
  const lead = group.find((p) => p.verb) ?? null;
  const meaning = lead?.meaning ?? null;
  part.verb = lead?.verb ?? null;

  // Mode and equipment from the verb.
  part.mode = meaning?.mode ?? null;
  let equipment = meaning?.equipment ?? null;
  if (equipment === 'previous') {
    equipment = previous?.equipment && meaning?.previousFrom?.includes(previous.equipment) ? previous.equipment : 'bench';
  } else if (meaning?.previousFrom && previous?.equipment && meaning.previousFrom.includes(previous.equipment)) {
    equipment = previous.equipment;
  }
  // Equipment words win over the verb's usual equipment ("leave in oven", "set in fridge").
  const named = group.find((p) => p.equipmentWord)?.equipmentWord ?? null;
  if (named && !(meaning && (meaning.mode === 'active' && named === 'fridge'))) equipment = named;
  if (equipment === null && part.mode === 'passive') equipment = 'bench';
  part.equipment = equipment;
  if (!part.mode && part.equipment) part.mode = EQUIPMENT_MODE[part.equipment] ?? null;
  if (part.verb === 'rest' && group.some((p) => p.fridgeRest) && !named) part.equipment = 'fridge';

  // Measures: the first of each in the group.
  const relativePiece = group.find((p) => p.relative);
  part.minutes = group.find((p) => p.minutes)?.minutes ?? relativePiece?.relative ?? null;
  part.relativeTime = Boolean(relativePiece);
  part.setting = group.find((p) => p.setting)?.setting ?? null;
  part.checkEvery = group.find((p) => p.checkEvery)?.checkEvery ?? null;
  part.dependsOn = group.flatMap((p) => p.dependsOn);
  part.templateRef = group.find((p) => p.templateRef)?.templateRef ?? null;

  // A time that runs on carries on the step before: same mode, equipment and setting.
  if (part.relativeTime && previous) {
    if (!lead) {
      part.mode = previous.mode;
      part.equipment = previous.equipment;
    }
    if (!part.setting && part.equipment === previous.equipment) part.setting = previous.setting;
  }

  // Cues.
  part.atService = group.some((p) => p.service);
  part.noGap = group.some((p) => p.noGap);
  if (group.some((p) => p.activeWord) && part.mode) part.mode = 'active';
  // A check-in of three minutes or less: you stay with it.
  if (part.mode === 'check-in' && part.minutes && (part.minutes.max ?? part.minutes.min) <= 3) part.mode = 'active';
  // Left overnight off the stove: in the fridge.
  if (part.mode === 'passive' && part.equipment === 'bench' && group.some((p) => /\bovernight\b/.test(p.text.toLowerCase()))) {
    part.equipment = 'fridge';
  }

  if (group.some((p) => p.cooling)) {
    part.critical = 'cooling';
    part.pausable = false;
    part.pauseBlocker = 'cooling';
  } else if (meaning?.pauseBlocker) {
    part.pausable = false;
    part.pauseBlocker = meaning.pauseBlocker;
  }  // Reheating is a critical point (a temperature check), but can be dropped for a ticket.
  if (!part.critical && group.some((p) => p.reheat)) part.critical = 'reheat';

  return part;
}

/** "Rinse, pat dry, portion": neighbouring parts of the same kind with no times are one. */
function joinAlike(parts: ReadPart[]): ReadPart[] {
  const joined: ReadPart[] = [];
  for (const part of parts) {
    const before = joined.at(-1);
    const alike =
      before &&
      before.mode === part.mode &&
      before.equipment === part.equipment &&
      !before.minutes &&
      !part.minutes &&
      !part.relativeTime &&
      before.atService === part.atService;
    if (!alike) {
      joined.push(part);
      continue;
    }
    before.text = `${before.text}\u0000${part.text}`;
    before.noGap ||= part.noGap;
    before.setting ??= part.setting;
    before.checkEvery ??= part.checkEvery;
    before.templateRef ??= part.templateRef;
    before.dependsOn = [...before.dependsOn, ...part.dependsOn];
    if (!part.pausable) {
      before.pausable = false;
      before.pauseBlocker ??= part.pauseBlocker;
    }
  }
  return joined;
}

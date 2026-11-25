/**
 * Finding technique words in a step or prep note (SPEC → Techniques: "the
 * step reader recognises technique names in steps and prep notes and links
 * them"). Pure: given text and the chef's techniques, it splits the text
 * into plain pieces and linked pieces, keeping the chef's wording exactly.
 *
 * Matches whole words, ignoring case and accents, the longest name first
 * ("beurre noisette" before "beurre"), and allows the usual endings:
 * "quenelle" finds "quenelles", "blanch" finds "blanched" and "blanching".
 */

import { normalizeName } from '../ingredients/names';

export interface Named {
  id: string;
  name: string;
  aliases: string[];
}

export interface TextPiece {
  text: string;
  /** The technique this piece names, if any. */
  techniqueId: string | null;
}

/** A word's possible endings: plural, past, -ing (with a doubled consonant). */
const ENDINGS = '(?:s|es|d|ed|ing|[a-z]ed|[a-z]ing)?';

/** A name as a regular expression: spaces match spaces or hyphens, a final e may drop ("pickl-ing"). */
function pattern(name: string): string {
  const base = normalizeName(name);
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s-]+');
  return base.endsWith('e') ? `${escaped.slice(0, -1)}(?:e)?` : escaped;
}

/** Lower case and no accents, one character for one (so positions map back to the original). */
function fold(text: string): string {
  return [...text]
    .map((ch) => (ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '') || ch).charAt(0).toLowerCase())
    .join('');
}

/** Splits text into pieces, linking each technique mention. Text with none comes back as one piece. */
export function findMentions(text: string, techniques: readonly Named[]): TextPiece[] {
  const names = techniques
    .flatMap((t) => [t.name, ...t.aliases].map((name) => ({ id: t.id, name })))
    .filter((n) => normalizeName(n.name).length >= 3)
    .sort((a, b) => b.name.length - a.name.length);
  if (names.length === 0 || !text) return [{ text, techniqueId: null }];

  const folded = fold(text);
  const taken: { start: number; end: number; id: string }[] = [];
  for (const { id, name } of names) {
    const regex = new RegExp(`(?<![a-z0-9])${pattern(name)}${ENDINGS}(?![a-z0-9])`, 'g');
    for (const match of folded.matchAll(regex)) {
      const start = match.index;
      const end = start + match[0].length;
      if (taken.some((t) => start < t.end && end > t.start)) continue;
      taken.push({ start, end, id });
    }
  }
  taken.sort((a, b) => a.start - b.start);

  const pieces: TextPiece[] = [];
  let cursor = 0;
  for (const t of taken) {
    if (t.start > cursor) pieces.push({ text: text.slice(cursor, t.start), techniqueId: null });
    pieces.push({ text: text.slice(t.start, t.end), techniqueId: t.id });
    cursor = t.end;
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), techniqueId: null });
  return pieces;
}

/** The techniques a text mentions, each once. */
export function mentionedIds(text: string, techniques: readonly Named[]): string[] {
  return [...new Set(findMentions(text, techniques).flatMap((p) => (p.techniqueId ? [p.techniqueId] : [])))];
}

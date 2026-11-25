/**
 * Draft or ready (SPEC → Draft or ready; DECISIONS 5, 39).
 *
 * A variation is ready when every step has been confirmed and every part of
 * it has a mode and a time, and check-in and passive parts have equipment.
 * Exceptions, because there's nothing to schedule:
 * - a part done at service ("to order") needs no time;
 * - a part that's only a hold ("holds 3 days") needs nothing.
 * A variation with no method is a draft.
 */

import type { StepMode } from './parseStep';

export interface PartToCheck {
  text: string;
  mode: StepMode | null;
  minutesMin: number | null;
  equipment: unknown;
  atService: boolean;
  hold: unknown;
}

export interface StepToCheck {
  text: string;
  confirmed: boolean;
  parts: readonly PartToCheck[];
}

export type MissingField = 'method' | 'mode' | 'time' | 'equipment' | 'confirm';

export interface Missing {
  /** Index into the steps; -1 for "no method yet". */
  step: number;
  /** Index into that step's parts, or null for the step as a whole. */
  part: number | null;
  field: MissingField;
  /** "Step 3: no time", "Step 2, blend: no equipment". */
  text: string;
}

const NEEDS: Record<Exclude<MissingField, 'method' | 'confirm'>, string> = {
  mode: 'what kind of step?',
  time: 'no time',
  equipment: 'no equipment',
};

/** Everything that keeps these steps a draft, in order. Empty = ready. */
export function whatsMissing(steps: readonly StepToCheck[]): Missing[] {
  if (steps.length === 0) return [{ step: -1, part: null, field: 'method', text: 'No method yet' }];
  const missing: Missing[] = [];
  steps.forEach((step, stepIndex) => {
    step.parts.forEach((part, partIndex) => {
      const holdOnly = part.mode === null && part.hold !== null && part.minutesMin === null;
      if (holdOnly) return;
      const label = step.parts.length > 1 ? `Step ${stepIndex + 1}, ${shorten(part.text)}` : `Step ${stepIndex + 1}`;
      const add = (field: keyof typeof NEEDS) => missing.push({ step: stepIndex, part: partIndex, field, text: `${label}: ${NEEDS[field]}` });
      if (!part.mode) add('mode');
      if (part.minutesMin === null && !part.atService) add('time');
      if ((part.mode === 'check-in' || part.mode === 'passive') && !part.equipment) add('equipment');
    });
    if (!step.confirmed) missing.push({ step: stepIndex, part: null, field: 'confirm', text: `Step ${stepIndex + 1}: not confirmed` });
  });
  return missing;
}

export function isReady(steps: readonly StepToCheck[]): boolean {
  return whatsMissing(steps).length === 0;
}

/** The first few words, for naming a part of a step. */
function shorten(text: string): string {
  const words = text.trim().split(/\s+/);
  return words.length > 4 ? `${words.slice(0, 4).join(' ')}…` : words.join(' ');
}

/**
 * The step reader (SPEC → Step language and parser). Built in Phase 4;
 * this stub only fixes the shape so other code can depend on it.
 */

/** The three step modes. Fixed by the app (DECISIONS 4 and 16). */
export const STEP_MODES = ['active', 'check-in', 'passive'] as const;
export type StepMode = (typeof STEP_MODES)[number];

/** What the reader got from one line. Phase 4 adds time, equipment and the rest. */
export interface StepReading {
  text: string;
  /** null = couldn't tell: shown as an empty chip for the chef to fill. */
  mode: StepMode | null;
}

/** Stub: keeps the text and reads nothing from it yet. */
export function parseStep(text: string): StepReading {
  return { text: text.trim(), mode: null };
}

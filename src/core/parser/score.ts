/**
 * Scores the step reader against the test set (tests/fixtures/
 * step-parser-test-set.json; SPEC → Testing). Run with `npm run parser:score`.
 *
 * A case is fully correct when the reader finds the same number of parts and
 * each part matches on mode, time, equipment, setting, flags, "check every"
 * and the components it needs, and the line's hold and critical point match.
 *
 * `scales_with` is reported on its own, not in the score: it links a step to
 * one of the recipe's lines, and the test set doesn't list the lines.
 */

import { partFlags, readStep, type ReadPart } from './parseStep';

export interface FixtureStep {
  mode?: string;
  minutes?: { min: number; max: number | null };
  equipment?: string;
  setting?: string;
  flags?: string[];
  check_every?: number;
  depends_on?: string[];
  scales_with?: string;
  hold?: { days?: number; hours?: number; where: string };
  critical?: string;
}

export interface FixtureCase {
  id: number;
  recipe?: string;
  text: string;
  expected: FixtureStep[];
  hold?: { days?: number; hours?: number; where: string };
  critical?: string;
  flags?: string[];
}

export interface CaseResult {
  id: number;
  text: string;
  correct: boolean;
  /** What didn't match, in words: "part 2 equipment: expected bench, read blender". */
  misses: string[];
}

export interface ScoreReport {
  correct: number;
  total: number;
  results: CaseResult[];
}

/** Reads every case in order; a case sees the case before it when it's the same recipe. */
export function scoreFixtures(cases: readonly FixtureCase[]): ScoreReport {
  let previous: ReadPart | null = null;
  let recipe: string | undefined;
  const results = cases.map((testCase) => {
    if (testCase.recipe !== recipe) previous = null;
    recipe = testCase.recipe;
    const parts = readStep(testCase.text, { previous });
    previous = parts.at(-1) ?? previous;
    const misses = compareCase(testCase, parts);
    return { id: testCase.id, text: testCase.text, correct: misses.length === 0, misses };
  });
  return { correct: results.filter((r) => r.correct).length, total: results.length, results };
}

const equipmentName = (name: string | null | undefined) => (name ?? null)?.replace(/-/g, ' ') ?? null;
const holdMinutes = (hold: { days?: number; hours?: number }) => (hold.days ?? 0) * 1440 + (hold.hours ?? 0) * 60;
const show = (value: unknown) => (value === null || value === undefined ? 'nothing' : JSON.stringify(value));

export function compareCase(testCase: FixtureCase, parts: ReadPart[]): string[] {
  const misses: string[] = [];
  if (parts.length !== testCase.expected.length) {
    misses.push(`parts: expected ${testCase.expected.length}, read ${parts.length}`);
    return misses;
  }
  testCase.expected.forEach((expected, index) => {
    const part = parts[index]!;
    const label = parts.length > 1 ? `part ${index + 1} ` : '';
    const check = (field: string, want: unknown, got: unknown) => {
      if (JSON.stringify(want) !== JSON.stringify(got)) misses.push(`${label}${field}: expected ${show(want)}, read ${show(got)}`);
    };
    check('mode', expected.mode ?? null, part.mode);
    check('minutes', expected.minutes ?? null, part.minutes);
    check('equipment', equipmentName(expected.equipment), part.equipment);
    check('setting', expected.setting ?? null, part.setting);
    check('flags', [...(expected.flags ?? [])].sort(), partFlags(part).sort());
    check('check every', expected.check_every ?? null, part.checkEvery);
    check('needs', expected.depends_on ?? [], part.dependsOn);
  });

  // Holds and critical points belong to the line, wherever the reader put them.
  const wantHold = testCase.hold ?? testCase.expected.find((e) => e.hold)?.hold ?? null;
  const gotHold = parts.find((p) => p.hold)?.hold ?? null;
  const want = wantHold ? { minutes: holdMinutes(wantHold), where: wantHold.where } : null;
  if (JSON.stringify(want) !== JSON.stringify(gotHold)) misses.push(`hold: expected ${show(want)}, read ${show(gotHold)}`);
  const wantCritical = testCase.critical ?? testCase.expected.find((e) => e.critical)?.critical ?? null;
  const gotCritical = parts.find((p) => p.critical)?.critical ?? null;
  if (wantCritical !== gotCritical) misses.push(`critical: expected ${show(wantCritical)}, read ${show(gotCritical)}`);
  return misses;
}

/** The report as printed by `npm run parser:score`. */
export function formatReport(report: ScoreReport): string {
  const percent = Math.round((report.correct / report.total) * 100);
  const lines = [`Step reader: ${report.correct} of ${report.total} fully correct (${percent}%)`, ''];
  for (const result of report.results.filter((r) => !r.correct)) {
    lines.push(`✗ ${result.id}. ${result.text}`);
    for (const miss of result.misses) lines.push(`    ${miss}`);
  }
  return lines.join('\n');
}

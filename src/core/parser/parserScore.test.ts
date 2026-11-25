import { describe, expect, it } from 'vitest';
import raw from '../../../tests/fixtures/step-parser-test-set.json?raw';
import { formatReport, scoreFixtures, type FixtureCase } from './score';

/**
 * The step reader against the test set. `npm run parser:score` runs only
 * this file and prints the score and every miss; `npm test` runs it too, so
 * the score can't quietly drop below the Phase 4 bar.
 */
describe('step reader test set', () => {
  it('reads at least 80% of the cases fully correctly', () => {
    const cases = (JSON.parse(raw) as { cases: FixtureCase[] }).cases;
    const report = scoreFixtures(cases);
    console.log(formatReport(report));
    expect(report.correct / report.total).toBeGreaterThanOrEqual(0.8);
  });
});

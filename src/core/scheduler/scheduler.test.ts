import { describe, expect, it } from 'vitest';
import { placeholderScheduler } from './scheduler';

describe('placeholderScheduler', () => {
  it('leaves every job as a manual to-do', () => {
    const jobs = [
      { id: 'a', label: 'Brown chicken stock' },
      { id: 'b', label: 'Pickled shallots' },
    ];
    const plan = placeholderScheduler.plan({ jobs });
    expect(plan.placed).toEqual([]);
    expect(plan.unplaced).toEqual(jobs);
  });
});

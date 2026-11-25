import { describe, expect, it } from 'vitest';
import { greedyScheduler, type PlanJob, type PlanPart, type ServiceWindow } from './scheduler';

/** Hand-checked plans (BUILD_ORDER → Phase 8). Times are minutes from midnight: 600 = 10:00. */

const part = (key: string, mode: PlanPart['mode'], minutes: number, extra: Partial<PlanPart> = {}): PlanPart => ({
  key,
  label: key,
  mode,
  minutes,
  equipment: null,
  setting: null,
  pausable: true,
  pauseBlocker: null,
  noGap: false,
  ...extra,
});

const at = (plan: ReturnType<typeof greedyScheduler.plan>, key: string) => plan.parts.find((p) => p.partKey === key)!;

describe('the greedy scheduler', () => {
  it('starts the long passive chain first, and fills the gap with active work', () => {
    // Stock: roast 45 (oven), then simmer 120. Chopping: 30 min hands-on. Ready by 13:00.
    const jobs: PlanJob[] = [
      { id: 'chop', label: 'Brunoise', readyBy: 780, parts: [part('chop', 'active', 30)] },
      { id: 'stock', label: 'Stock', readyBy: 780, parts: [part('roast', 'passive', 45, { equipment: 'oven' }), part('simmer', 'check-in', 120, { equipment: 'hob' })] },
    ];
    const plan = greedyScheduler.plan({ start: 600, jobs });
    expect(at(plan, 'roast')).toMatchObject({ start: 600, end: 645 });
    expect(at(plan, 'chop')).toMatchObject({ start: 600, end: 630 });
    expect(at(plan, 'simmer')).toMatchObject({ start: 645, end: 765 });
    expect(plan.jobs.every((j) => j.late === 0)).toBe(true);
    // Hands free from 10:30 to 10:45, while the bones roast; the simmer needs looking at, so it counts as busy.
    expect(plan.free).toEqual([{ start: 630, end: 645 }]);
  });

  it('never puts two active parts at once', () => {
    const jobs: PlanJob[] = [
      { id: 'a', label: 'A', readyBy: 720, parts: [part('a', 'active', 20)] },
      { id: 'b', label: 'B', readyBy: 700, parts: [part('b', 'active', 20)] },
    ];
    const plan = greedyScheduler.plan({ start: 600, jobs });
    // B has the earlier deadline, so it goes first.
    expect([at(plan, 'b').start, at(plan, 'a').start]).toEqual([600, 620]);
  });

  it('keeps an oven at one temperature at a time', () => {
    const jobs: PlanJob[] = [
      { id: 'beets', label: 'Beets', readyBy: 720, parts: [part('beets', 'passive', 60, { equipment: 'oven', setting: '200°C' })] },
      { id: 'meringue', label: 'Meringue', readyBy: 900, parts: [part('meringue', 'passive', 120, { equipment: 'oven', setting: '90°C' })] },
      { id: 'potatoes', label: 'Potatoes', readyBy: 720, parts: [part('potatoes', 'passive', 60, { equipment: 'oven', setting: '200°C' })] },
    ];
    const plan = greedyScheduler.plan({ start: 600, jobs });
    expect(at(plan, 'beets').start).toBe(600);
    expect(at(plan, 'potatoes').start).toBe(600);
    expect(at(plan, 'meringue').start).toBe(660);
  });

  it('waits for the job a step needs', () => {
    const jobs: PlanJob[] = [
      { id: 'sauce', label: 'Sauce', readyBy: 780, after: ['stock'], parts: [part('reduce', 'check-in', 45)] },
      { id: 'stock', label: 'Stock', readyBy: 780, parts: [part('simmer', 'check-in', 90)] },
    ];
    const plan = greedyScheduler.plan({ start: 600, jobs });
    expect(at(plan, 'reduce').start).toBe(690);
  });

  it('flags what can’t be ready in time', () => {
    const jobs: PlanJob[] = [{ id: 'braise', label: 'Braise', readyBy: 720, parts: [part('braise', 'passive', 180)] }];
    const plan = greedyScheduler.plan({ start: 600, jobs });
    expect(plan.jobs[0]).toMatchObject({ end: 780, late: 60 });
  });

  describe('service windows (PS5)', () => {
    const lunch: ServiceWindow[] = [{ name: 'Lunch', start: 720, end: 870 }];

    it('waits until after service with what can’t be left, when it can still be ready', () => {
      const jobs: PlanJob[] = [
        { id: 'work', label: 'Prep', readyBy: 1080, parts: [part('work', 'active', 140)] },
        { id: 'sabayon', label: 'Sabayon', readyBy: 1080, parts: [part('sabayon', 'active', 20, { pausable: false, pauseBlocker: 'emulsion' })] },
      ];
      const plan = greedyScheduler.plan({ start: 600, jobs, windows: lunch });
      expect(at(plan, 'sabayon')).toMatchObject({ start: 870, needsCover: null });
    });

    it('puts it in the window, flagged “needs cover”, when the sequence needs it', () => {
      const jobs: PlanJob[] = [
        { id: 'stock', label: 'Stock', readyBy: 900, parts: [part('simmer', 'check-in', 120), part('chill', 'passive', 90, { pausable: false, pauseBlocker: 'cooling' })] },
      ];
      const plan = greedyScheduler.plan({ start: 600, jobs, windows: lunch });
      expect(at(plan, 'chill')).toMatchObject({ start: 720, needsCover: 'cooling' });
    });

    it('carries on with pausable prep through service', () => {
      const jobs: PlanJob[] = [{ id: 'pick', label: 'Pick herbs', readyBy: 1080, parts: [part('pick', 'active', 30)] }];
      const plan = greedyScheduler.plan({ start: 730, jobs, windows: lunch });
      expect(at(plan, 'pick')).toMatchObject({ start: 730, needsCover: null });
    });
  });

  it('starts a no-gap part straight after the one before, ahead of other work', () => {
    const jobs: PlanJob[] = [
      { id: 'potatoes', label: 'Mash', readyBy: 900, parts: [part('boil', 'check-in', 20), part('rice', 'active', 10, { noGap: true })] },
      { id: 'chop', label: 'Chop', readyBy: 640, parts: [part('chop', 'active', 40)] },
    ];
    const plan = greedyScheduler.plan({ start: 600, jobs });
    // The chopping is urgent and starts first; the ricing should follow the boil at 10:20 but hands are busy until 10:40.
    expect(at(plan, 'rice')).toMatchObject({ start: 640, gapBefore: true });
  });

  it('doesn’t start something held warm so early it would be held too long', () => {
    // Beurre blanc: 20 minutes to make, holds warm 2 hours, ready by 18:00 → not before 15:40.
    const jobs: PlanJob[] = [{ id: 'bb', label: 'Beurre blanc', readyBy: 1080, notBefore: 1080 - 120 - 20, parts: [part('bb', 'active', 20)] }];
    expect(at(greedyScheduler.plan({ start: 600, jobs }), 'bb').start).toBe(940);
  });

  it('a job with no parts or no deadline still gets placed', () => {
    const jobs: PlanJob[] = [
      { id: 'empty', label: 'Nothing', readyBy: 700, parts: [] },
      { id: 'whenever', label: 'Whenever', readyBy: null, parts: [part('x', 'active', 10)] },
    ];
    const plan = greedyScheduler.plan({ start: 600, jobs });
    expect(plan.jobs.map((j) => j.jobId)).toEqual(['whenever']);
    expect(plan.unplaced).toEqual([]);
  });

  it('reports a job that waits on itself through another', () => {
    const jobs: PlanJob[] = [
      { id: 'a', label: 'A', readyBy: 700, after: ['b'], parts: [part('a', 'active', 10)] },
      { id: 'b', label: 'B', readyBy: 700, after: ['a'], parts: [part('b', 'active', 10)] },
    ];
    expect(greedyScheduler.plan({ start: 600, jobs }).unplaced.map((u) => u.jobId).sort()).toEqual(['a', 'b']);
  });
});

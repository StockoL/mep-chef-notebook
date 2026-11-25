import { describe, expect, it } from 'vitest';
import { greedyScheduler, type PlanJob, type PlanPart } from '../scheduler/scheduler';
import { prepState, type PartRun } from './progress';

const part = (key: string, mode: PlanPart['mode'], minutes: number): PlanPart => ({
  key,
  label: key,
  mode,
  minutes,
  equipment: null,
  setting: null,
  pausable: true,
  pauseBlocker: null,
  noGap: false,
});

// 10:00 start. Chop (30, hands-on) then pick herbs (20, hands-on): ready by 12:00 and 10:55.
const jobs: PlanJob[] = [
  { id: 'chop', label: 'Chop', readyBy: 720, parts: [part('chop', 'active', 30)] },
  { id: 'herbs', label: 'Herbs', readyBy: 655, parts: [part('herbs', 'active', 20)] },
];
const plan = greedyScheduler.plan({ start: 600, jobs });
const state = (runs: PartRun[], now: number) => prepState({ plan, jobs, windows: [], runs, now });

describe('prep progress (SM1, SM2)', () => {
  it('starts with the first planned part as the current task', () => {
    // Herbs first: less slack.
    const s = state([], 600);
    expect(s.queue.map((p) => p.partKey)).toEqual(['herbs', 'chop']);
    expect([s.behind, s.done, s.total]).toEqual([0, 0, 2]);
  });

  it('tracks what’s running and when it’s due', () => {
    const s = state([{ jobId: 'herbs', partKey: 'herbs', startedAt: 600, doneAt: null }], 610);
    expect(s.running.map((r) => [r.part.partKey, r.dueAt])).toEqual([['herbs', 620]]);
    expect(s.queue.map((p) => p.partKey)).toEqual(['chop']);
  });

  it('says how far behind, and keeps the order when nothing will be late', () => {
    // Herbs took 25 instead of 20; the chopping starts 5 min late but there's lots of time before 12:00.
    const s = state([{ jobId: 'herbs', partKey: 'herbs', startedAt: 600, doneAt: 625 }], 625);
    expect(s.behind).toBe(5);
    expect(s.replannedFor).toBeNull();
    expect(s.queue[0]).toMatchObject({ partKey: 'chop', start: 620 });
  });

  it('re-orders the unstarted parts only when a job would be late', () => {
    // Started late: at 11:30 nothing's been done; 90 min behind, both would be late.
    const tight: PlanJob[] = [
      { id: 'chop', label: 'Chop', readyBy: 720, parts: [part('chop', 'active', 30)] },
      { id: 'herbs', label: 'Herbs', readyBy: 700, parts: [part('herbs', 'active', 20)] },
    ];
    const tightPlan = greedyScheduler.plan({ start: 600, jobs: tight });
    const s = prepState({ plan: tightPlan, jobs: tight, windows: [], runs: [], now: 690 });
    expect(s.replannedFor).toEqual(['herbs', 'chop']);
    expect(s.queue[0]).toMatchObject({ partKey: 'herbs', start: 690 });
  });

  it('during service: order kept, nothing re-ordered', () => {
    const s = prepState({ plan, jobs, windows: [{ name: 'Lunch', start: 600, end: 870 }], runs: [], now: 700 });
    expect(s.inService?.name).toBe('Lunch');
    expect(s.replannedFor).toBeNull();
    expect(s.queue.map((p) => p.partKey)).toEqual(['herbs', 'chop']);
  });
});

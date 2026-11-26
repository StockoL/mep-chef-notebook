import { useEffect, useState } from 'preact/hooks';
import type { PlacedPart } from '../../core/scheduler/scheduler';
import { minutesToTime } from '../../core/time/calendar';
import { criticalTarget } from '../../core/foodSafety/foodSafety';
import { getPlace } from '../../data/kitchens';
import { finishPart, getPrepView, runKey, startPart, undoFinish, undoStart, type PrepView } from '../../data/prep';
import { equipmentNames } from '../../data/steps';
import type { Id, PartRun } from '../../data/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { useWakeLock } from '../hooks/useWakeLock';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

const ACTION = { active: 'Done', 'check-in': 'Started', passive: 'Started' } as const;

/**
 * Prep mode (UX → Prep mode; SM1–SM4): for the hours before service, not
 * service itself. One task large with a countdown (into negative time), one
 * big button; the next two smaller; things left to cook as a strip with
 * their own countdowns. "6 min behind" when late; the unstarted jobs are
 * re-ordered only if one would miss its time. The screen stays on.
 * Common path: Done (1 tap) finishes a task and starts the next.
 */
export function Prep() {
  const minute = useClock(60_000);
  const second = useClock(1_000);
  const wake = useWakeLock();
  const place = useLiveQuery(() => getPlace());
  const view = useLiveQuery(async () => (place ? getPrepView(place.kitchenId, minute) : undefined), [place?.kitchenId, minute.getTime()]);
  const names = useLiveQuery(() => equipmentNames());
  const [busy, setBusy] = useState(false);
  if (!view || !place) return <ScreenHeader title="Prep" back={{ href: paths.plan, label: 'Plan' }} />;

  const { state } = view;
  const runningActive = state.running.find((r) => r.part.mode === 'active');
  const current = runningActive?.part ?? state.queue[0];
  const currentRun = current ? view.runs.get(runKey(current.jobId, current.partKey)) : undefined;
  const upNext = state.queue.filter((p) => p !== current).slice(0, 2);
  const strip = state.running.filter((r) => r.part.mode !== 'active');
  const name = (part: PlacedPart) => view.plan.jobs.get(part.jobId)?.view.name ?? part.label;

  async function act(part: PlacedPart, run: PartRun | undefined, interrupted = false) {
    if (busy || !place) return;
    setBusy(true);
    try {
      if (!run) {
        const id = await trackSave(startPart(place.kitchenId, part, view!));
        showMessage(`${name(part)}: started.`, () => undoStart(id));
        return;
      }
      const finished = await trackSave(finishPart(run.id, view!, { interrupted }));
      // One tap: finishing a hands-on task starts the next hands-on one.
      const fresh = await getPrepView(place.kitchenId, new Date());
      const next = fresh.state.queue[0];
      const nextId = part.mode === 'active' && next?.mode === 'active' && !fresh.state.running.some((r) => r.part.mode === 'active') ? await startPart(place.kitchenId, next, fresh) : null;
      const took = Math.round((Date.now() - Date.parse(run.startedAt)) / 60_000);
      showMessage(`${name(part)}: done${interrupted ? ' (interrupted, not learned from)' : ` in ${took} min`}.${finished.tickedItemId ? ' Ticked on the sheet.' : ''}`, async () => {
        if (nextId) await undoStart(nextId);
        await undoFinish(finished);
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="flow prep">
      <ScreenHeader title="Prep" back={{ href: paths.plan, label: 'Plan' }} />
      <p class="prep__status" data-behind={state.behind > 0 && !state.inService}>
        {statusLine(view)} · {state.done} of {state.total} done
      </p>
      {state.replannedFor && (
        <p class="plan-flag">Re-ordered so {state.replannedFor.map((id) => view.plan.jobs.get(id)?.view.name).filter(Boolean).join(', ')} can still be ready in time.</p>
      )}
      {state.inService && <p class="field__hint">{state.inService.name}: drop it for tickets. No countdown; the order stays.</p>}
      {wake === 'unsupported' && <p class="field__hint">This phone can’t keep the screen on from here: turn up Auto-Lock while you prep.</p>}

      {current ? (
        <article class="prep-current" data-mode={current.mode} aria-live="polite">
          <p class="prep-current__job">{name(current)}</p>
          <h1 class="prep-current__task">{current.label}</h1>
          <p class="list-row__meta">{[kit(current, names), `planned ${minutesToTime(current.start)}`].filter(Boolean).join(' · ')}</p>
          {current.critical && <p class="plan-flag">{criticalTarget(current.critical, view.plan.targets[current.critical])?.text}</p>}
          {currentRun && !state.inService && <Countdown run={currentRun} part={current} now={second} />}
          <button class="button prep-current__action" type="button" data-variant="primary" disabled={busy} onClick={() => act(current, currentRun)}>
            {currentRun ? 'Done' : current.mode === 'active' ? 'Start' : ACTION[current.mode]}
          </button>
          {currentRun && (
            <button class="button" type="button" data-variant="ghost" disabled={busy} onClick={() => act(current, currentRun, true)}>
              Done, but I was interrupted
            </button>
          )}
        </article>
      ) : (
        <div class="empty-state flow">
          <p>{state.total ? 'Nothing left to start. Well done.' : 'Nothing planned yet.'}</p>
          <p class="empty-state__hint">
            The plan comes from <a href={paths.today}>today’s sheet</a>: recipes with a confirmed method.
          </p>
        </div>
      )}

      {strip.length > 0 && (
        <section class="flow" aria-labelledby="running-title">
          <h2 id="running-title" class="section-label">
            Running
          </h2>
          <ul class="row-list" role="list">
            {strip.map((r) => {
              const run = view.runs.get(runKey(r.part.jobId, r.part.partKey))!;
              return (
                <li key={run.id} class="list-row prep-running">
                  <span class="list-row__main">
                    <span class="list-row__title">{name(r.part)}</span>
                    <span class="list-row__meta">{[r.part.label, kit(r.part, names)].filter(Boolean).join(' · ')}</span>
                  </span>
                  {!state.inService && <Countdown run={run} part={r.part} now={second} small />}
                  <button class="button" type="button" disabled={busy} onClick={() => act(r.part, run)}>
                    Done
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {upNext.length > 0 && (
        <section class="flow" aria-labelledby="next-title">
          <h2 id="next-title" class="section-label">
            Next
          </h2>
          <ul class="row-list" role="list">
            {upNext.map((part) => (
              <li key={`${part.jobId}-${part.partKey}`} class="list-row" data-static>
                <span class="list-row__main">
                  <span class="list-row__title">{name(part)}</span>
                  <span class="list-row__meta">{[part.label, kit(part, names)].filter(Boolean).join(' · ')}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function statusLine(view: PrepView): string {
  const { behind, inService } = view.state;
  if (inService) return `In ${inService.name}`;
  if (behind > 0) return `${Math.round(behind)} min behind`;
  if (behind < -1) return `${Math.round(-behind)} min ahead`;
  return 'On time';
}

function kit(part: PlacedPart, names: Map<Id, string> | undefined): string {
  return [part.equipment ? names?.get(part.equipment) : null, part.setting].filter(Boolean).join(' ');
}

/** Time left on a task, carrying on into negative time (SM1). */
function Countdown({ run, part, now, small }: { run: PartRun; part: PlacedPart; now: Date; small?: boolean }) {
  const planned = (part.end - part.start) * 60;
  const left = Math.round(planned - (now.getTime() - Date.parse(run.startedAt)) / 1000);
  const over = left < 0;
  const size = Math.abs(left);
  const text = `${over ? '−' : ''}${Math.floor(size / 60)}:${String(size % 60).padStart(2, '0')}`;
  return (
    <p class="prep-countdown" data-over={over} data-small={small} role="timer" aria-label={over ? `${Math.ceil(size / 60)} minutes over` : `${Math.ceil(size / 60)} minutes left`}>
      {text}
    </p>
  );
}

/** The time, ticking every `ms`. */
function useClock(ms: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms]);
  return now;
}

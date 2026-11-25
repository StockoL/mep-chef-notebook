import { useEffect, useState } from 'preact/hooks';
import { minutesToTime } from '../../core/time/calendar';
import { criticalTarget } from '../../core/foodSafety/foodSafety';
import type { PlacedPart, ServiceWindow } from '../../core/scheduler/scheduler';
import { getPlace } from '../../data/kitchens';
import type { PlanView } from '../../data/plan';
import { getPrepView, runKey } from '../../data/prep';
import type { PartRun } from '../../data/types';
import { setItemDone } from '../../data/sheets';
import { equipmentNames } from '../../data/steps';
import { showMessage } from '../components/UndoBar';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

const MODE_LABELS = { active: 'Hands on', 'check-in': 'Keep an eye', passive: 'Left' } as const;

/**
 * The plan (UX → Plan; PS1, PS2, PS5): today's sheet in time order, in blocks
 * around your services. Hands-on work in order, things left to cook as
 * running bars, free time shaded, "needs cover" and "late" flagged, drafts
 * beside it as to-dos. Ticking here ticks the sheet: it's the same list.
 */
export function Plan() {
  const now = useMinute();
  const place = useLiveQuery(() => getPlace());
  const prep = useLiveQuery(async () => (place ? getPrepView(place.kitchenId, now) : undefined), [place?.kitchenId, now.getTime()]);
  const view = prep?.plan;
  const names = useLiveQuery(() => equipmentNames());
  if (!view) return <h1>Plan</h1>;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const nothing = view.plan.parts.length === 0 && view.todos.length === 0;
  return (
    <section class="flow">
      <h1>Plan</h1>
      <p class="menu-summary">
        From {minutesToTime(view.start)}
        {view.windows.length > 0 && ` · ${view.windows.map((w) => `${w.name} ${minutesToTime(w.start)}`).join(' · ')}`}
      </p>
      {view.plan.parts.length > 0 && (
        <a class="button" href={paths.prep} data-variant="primary">
          Start prep
        </a>
      )}
      {view.hints.map((hint) => (
        <p key={hint} class="field__hint">
          {hint}
        </p>
      ))}

      {nothing && (
        <div class="empty-state flow">
          <p>Nothing to plan yet.</p>
          <p class="empty-state__hint">
            Put items on <a href={paths.today}>today’s sheet</a>. Recipes with a confirmed method are planned; the rest wait here as to-dos.
          </p>
        </div>
      )}

      {view.plan.unplaced.map((u) => (
        <p key={u.jobId} class="plan-flag">
          {view.jobs.get(u.jobId)?.view.name}: {u.reason}
        </p>
      ))}

      {blocks(view).map((block) => (
        <section key={block.key} class="flow plan-block" data-service={block.service} aria-label={block.title}>
          <h2 class="plan-block__title">
            {block.title} <span class="list-row__meta">{block.when}</span>
          </h2>
          {block.service && <p class="field__hint">Service: prep carries on with what you can drop for a ticket.</p>}
          <ol class="plan-rows" role="list">
            {block.rows.map((row) =>
              row.kind === 'free' ? (
                <li key={`free-${row.start}`} class="plan-row" data-free>
                  <span class="plan-row__time">
                    {minutesToTime(row.start)}–{minutesToTime(row.end)}
                  </span>
                  <span class="plan-row__main">Free</span>
                </li>
              ) : (
                <PlanRow
                  key={`${row.part.jobId}-${row.part.partKey}`}
                  part={row.part}
                  view={view}
                  equipment={names}
                  now={nowMinutes}
                  run={prep?.runs.get(runKey(row.part.jobId, row.part.partKey))}
                />
              ),
            )}
          </ol>
        </section>
      ))}

      {view.todos.length > 0 && (
        <section class="flow" aria-labelledby="todos-title">
          <h2 id="todos-title">Beside the plan</h2>
          <p class="field__hint">Not planned: drafts and things with no recipe. Tick them off by hand.</p>
          <ul class="row-list" role="list">
            {view.todos.map(({ view: item, reason }) => (
              <li key={item.item.id} class="list-row">
                <button class="plan-tick" type="button" aria-label={`Done: ${item.name}`} onClick={() => tick(item.item.id, item.name)}>
                  <Icon name="tick" />
                </button>
                {item.componentId ? (
                  <a class="list-row__main" href={paths.component(item.componentId)}>
                    <span class="list-row__title">
                      {item.name} {item.amount}
                    </span>
                    <span class="list-row__meta">{reason}</span>
                  </a>
                ) : (
                  <span class="list-row__main">
                    <span class="list-row__title">
                      {item.name} {item.amount}
                    </span>
                    <span class="list-row__meta">{reason}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.done.length > 0 && (
        <details>
          <summary>
            Done ({view.done.length})
          </summary>
          <ul class="flow" role="list">
            {view.done.map((d) => (
              <li key={d.item.id}>
                ✓ {d.name}{' '}
                <button class="button" type="button" data-variant="ghost" onClick={() => trackSave(setItemDone(d.item.id, false))}>
                  Not done
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

async function tick(itemId: string, name: string) {
  await trackSave(setItemDone(itemId, true));
  showMessage(`${name}: done.`, () => setItemDone(itemId, false));
}

function PlanRow(props: { part: PlacedPart; view: PlanView; equipment: Map<string, string> | undefined; now: number; run: PartRun | undefined }) {
  const { part, view, equipment, now, run } = props;
  const info = view.jobs.get(part.jobId);
  const job = view.plan.jobs.find((j) => j.jobId === part.jobId);
  const isLast = job?.end === part.end && view.plan.parts.filter((p) => p.jobId === part.jobId).at(-1)?.partKey === part.partKey;
  const isFirst = view.plan.parts.find((p) => p.jobId === part.jobId)?.partKey === part.partKey;
  if (!info) return null;
  const kit = [part.equipment ? equipment?.get(part.equipment) : null, part.setting].filter(Boolean).join(' ');
  const critical = part.critical ? criticalTarget(part.critical, view.targets[part.critical]) : null;
  const flags = [
    critical?.text ?? null,
    part.needsCover ? `Needs cover: ${part.needsCover}` : null,
    part.gapBefore ? 'Should follow straight on from the step before' : null,
    isLast && job && job.late > 0 ? `${job.late} min late for ${info.readyByLabel?.replace('Ready by ', '') ?? 'its time'}` : null,
  ].filter(Boolean);
  const planPart = view.planJobs.find((j) => j.id === part.jobId)?.parts.find((p) => p.key === part.partKey);
  const status = run?.doneAt
    ? `✓ Done in ${Math.round((Date.parse(run.doneAt) - Date.parse(run.startedAt)) / 60_000)} min`
    : run
      ? 'Running now'
      : null;

  return (
    <li
      class="plan-row"
      data-mode={part.mode}
      data-late={isLast && job ? job.late > 0 : false}
      data-past={run?.doneAt ? true : !run && part.end <= now}
      data-now={run ? !run.doneAt : part.start <= now && part.end > now}
    >
      <span class="plan-row__time">
        {minutesToTime(part.start)}
        <span class="plan-row__end">–{minutesToTime(part.end)}</span>
      </span>
      <span class="plan-row__main">
        <span class="list-row__title">
          {info.forDay === 'tomorrow' && 'For tomorrow: '}
          {info.view.componentId ? <a href={paths.component(info.view.componentId)}>{info.view.name}</a> : info.view.name}
          {isFirst && info.view.amount && <span class="list-row__meta"> {info.view.amount}</span>}
        </span>
        <span class="list-row__meta">
          {[part.label, MODE_LABELS[part.mode], kit || null, planPart?.learnedFrom ? `your time (${planPart.learnedFrom} timings)` : null].filter(Boolean).join(' · ')}
        </span>
        {status && <span class="plan-status">{status}</span>}
        {isFirst && info.startedYesterday.length > 0 && <span class="list-row__meta">Started yesterday: {info.startedYesterday.join('; ')}</span>}
        {isLast && info.readyByLabel && <span class="list-row__meta">{info.readyByLabel}</span>}
        {flags.map((flag) => (
          <span key={flag} class="plan-flag">
            {flag}
          </span>
        ))}
      </span>
      {isLast && info.forDay === 'today' && (
        <button class="plan-tick" type="button" aria-label={`Done: ${info.view.name}`} onClick={() => tick(info.view.item.id, info.view.name)}>
          <Icon name="tick" />
        </button>
      )}
    </li>
  );
}

type Row = { kind: 'part'; start: number; part: PlacedPart } | { kind: 'free'; start: number; end: number };

/** Splits the plan into blocks around the services: before lunch, lunch, before dinner… */
function blocks(view: PlanView) {
  const rows: Row[] = [
    ...view.plan.parts.map((part) => ({ kind: 'part' as const, start: part.start, part })),
    ...view.plan.free.map((f) => ({ kind: 'free' as const, start: f.start, end: f.end })),
  ].sort((a, b) => a.start - b.start);
  if (rows.length === 0) return [];

  const windows = [...view.windows].sort((a, b) => a.start - b.start);
  const edges: { key: string; title: string; when: string; service: boolean; from: number; to: number }[] = [];
  let from = Number.NEGATIVE_INFINITY;
  windows.forEach((w: ServiceWindow, i) => {
    edges.push({ key: `before-${i}`, title: `Before ${w.name}`, when: `ready by ${minutesToTime(w.start)}`, service: false, from, to: w.start });
    edges.push({ key: `during-${i}`, title: w.name, when: `${minutesToTime(w.start)}–${minutesToTime(w.end)}`, service: true, from: w.start, to: w.end });
    from = w.end;
  });
  edges.push({ key: 'after', title: windows.length ? 'After service' : 'Today', when: '', service: false, from, to: Number.POSITIVE_INFINITY });

  return edges
    .map((edge) => ({ ...edge, rows: rows.filter((r) => r.start >= edge.from && r.start < edge.to) }))
    .filter((b) => b.rows.length > 0);
}

/** The time, refreshed every minute: the plan starts from now. */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}

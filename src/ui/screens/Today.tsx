import { useEffect, useState } from 'preact/hooks';
import { getBackupStatus } from '../../data/backup';
import { getCheckInDue, getThisWeeksGoal } from '../../data/goals';
import { getNextService, getPlace, getPlaceDetails, getServiceTimesOn, listShifts } from '../../data/kitchens';
import { setTimeChange } from '../../data/events';
import { isoDayOfWeek, minutesOfDay, minutesToTime, timeToMinutes, toCalendarDate } from '../../core/time/calendar';
import { Sheet } from '../components/Sheet';
import { trackSave } from '../saveStatus';
import { SheetPanel } from './Sheets';
import { countInbox } from '../../data/notes';
import { NO_KITCHEN_ID } from '../../data/types';
import { exportBackup } from '../backupActions';
import { InstallHint } from '../components/InstallHint';
import { formatDayAhead, formatDaysAgo } from '../format';
import { formatMinutes } from '../../core/time/formatMinutes';
import { getPrepView } from '../../data/prep';
import { clearInstallHintDismissal, installHintDismissed } from '../components/InstallHint';
import { isInstalled, isIos } from '../platform';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';

/**
 * Today (UX → Today; FEEL_PASS 5): the shift, not a checklist. From the top:
 * the date and kitchen, the day; the next service; one "Needs you" line
 * when something does; this week's goal; the next job from the plan; today's
 * sheet; other days' sheets.
 */
export function Today() {
  const now = useNow();
  const details = useLiveQuery(() => getPlaceDetails());
  const goal = useLiveQuery(() => getThisWeeksGoal(now), [dayKey(now)]);
  const kitchenId = details?.place.kitchenId;
  const kitchenName = kitchenId && kitchenId !== NO_KITCHEN_ID ? details?.kitchen?.name : null;
  const date = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  return (
    <section class="flow today">
      <header class="today__head">
        <p class="today__kicker">{[date, kitchenName].filter(Boolean).join(' · ')}</p>
        <h1>{now.toLocaleDateString('en-GB', { weekday: 'long' })}</h1>
        {kitchenId && <NextServiceLine kitchenId={kitchenId} now={now} />}
      </header>
      <NeedsYou now={now} />
      {goal?.text && (
        <a class="goal-line" href={paths.goal}>
          This week: {goal.text}
        </a>
      )}
      {kitchenId && <NextJob kitchenId={kitchenId} now={now} />}
      {kitchenId && <SheetPanel kitchenId={kitchenId} date={toCalendarDate(now)} isToday />}
      <a class="goal-line today__other" href={paths.sheets}>
        Other days’ sheets
      </a>
      <InstallHint />
    </section>
  );
}

/**
 * The next job from today's plan, with Start (FEEL_PASS 5): one tap into
 * prep mode. Only when there's a plan with something still to do.
 */
function NextJob({ kitchenId, now }: { kitchenId: string; now: Date }) {
  const minute = Math.floor(now.getTime() / 60_000);
  const view = useLiveQuery(() => getPrepView(kitchenId, now), [kitchenId, minute]);
  const next = view?.state.queue[0];
  if (!view || !next) return null;
  const name = view.plan.jobs.get(next.jobId)?.view.name;
  return (
    <a class="next-job" href={paths.prep}>
      <span class="next-job__main">
        <span class="next-job__when">Next · {minutesToTime(next.start)}</span>
        <span class="next-job__task">{next.label}</span>
        {name && name !== next.label && <span class="next-job__for">{name}</span>}
      </span>
      <span class="next-job__start">Start</span>
    </a>
  );
}

/**
 * "Lunch from 12:00 · in 1 h 20" / "Lunch on now · last bookings 14:30"
 * (K5). Tapping it opens today's times, for a one-off change (K6): 2 taps.
 * No services set: nothing here; "Needs you" says so.
 */
function NextServiceLine({ kitchenId, now }: { kitchenId: string; now: Date }) {
  const minute = Math.floor(now.getTime() / 60_000);
  const next = useLiveQuery(() => getNextService(kitchenId, now), [kitchenId, minute]);
  const [open, setOpen] = useState(false);

  if (kitchenId === NO_KITCHEN_ID || !next) return null;
  const until = timeToMinutes(next.firstTickets) - minutesOfDay(now);
  const text = next.onNow
    ? [`${next.name} on now`, next.lastBookings ? `last bookings ${next.lastBookings}` : null]
    : [
        `${next.name}${next.daysAhead === 0 ? '' : ` ${formatDayAhead(next.daysAhead, now)}`} from ${next.firstTickets}`,
        next.daysAhead === 0 && until > 0 ? `in ${formatMinutes(until)}` : null,
      ];
  return (
    <>
      <button class="next-service next-service__button" type="button" onClick={() => setOpen(true)}>
        {text.filter(Boolean).join(' · ')}
        {next.fromEvent && ' (changed)'} <Icon name="chevron-down" size="s" />
      </button>
      <TodaysTimes open={open} onClose={() => setOpen(false)} kitchenId={kitchenId} now={now} />
    </>
  );
}

/** Today's service times, each changeable just for today (a small event). */
function TodaysTimes({ open, onClose, kitchenId, now }: { open: boolean; onClose: () => void; kitchenId: string; now: Date }) {
  const times = useLiveQuery(() => getServiceTimesOn(kitchenId, now), [kitchenId, dayKey(now)]);
  const date = toCalendarDate(now);
  return (
    <Sheet open={open} onClose={onClose} title="Today’s times">
      {times?.length === 0 && <p class="field__hint">You don’t work any services today.</p>}
      {times?.map(({ service, usualStart, usualEnd, changedStart }) => (
        <div key={service.id} class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
          <label class="label" for={`today-${service.id}`}>
            {service.name} {changedStart && usualStart ? <span class="list-row__meta">(usually {usualStart})</span> : null}
          </label>
          <div class="cluster">
            <input
              class="input"
              id={`today-${service.id}`}
              type="time"
              value={changedStart ?? usualStart ?? ''}
              onInput={(e) => {
                const value = e.currentTarget.value || null;
                void trackSave(setTimeChange(kitchenId, date, service, value === usualStart ? null : value, usualEnd));
              }}
            />
            {changedStart && (
              <button class="button" type="button" data-variant="ghost" onClick={() => trackSave(setTimeChange(kitchenId, date, service, null, null))}>
                Back to {usualStart ?? 'usual'}
              </button>
            )}
          </div>
        </div>
      ))}
      <p class="field__hint">Changes here are for today only. Weddings and functions go in Events.</p>
      <a class="button" href={paths.events(kitchenId)} onClick={onClose}>
        Events
      </a>
    </Sheet>
  );
}

/**
 * "Needs you: 4 notes to sort · backup due" (FEEL_PASS 5): one line, only
 * when something does. Tap it for the list; each row says what to do and
 * goes there.
 */
function NeedsYou({ now }: { now: Date }) {
  const inbox = useLiveQuery(() => countInbox());
  const backup = useLiveQuery(() => getBackupStatus(now), [dayKey(now)]);
  const checkIn = useLiveQuery(() => getCheckInDue(now), [dayKey(now)]);
  const goal = useLiveQuery(() => getThisWeeksGoal(now), [dayKey(now)]);
  const place = useLiveQuery(() => getPlace());
  const kitchenId = place?.kitchenId;
  const shifts = useLiveQuery(async () => (kitchenId ? listShifts(kitchenId) : []), [kitchenId]);
  const next = useLiveQuery(async () => (kitchenId && kitchenId !== NO_KITCHEN_ID ? getNextService(kitchenId, now) : undefined), [kitchenId, dayKey(now)]);
  const [open, setOpen] = useState(false);
  // Within 90 minutes of the end of today's usual shift, or after it (SH3).
  const shiftEndingSoon = (shifts ?? []).some((shift) => shift.days.includes(isoDayOfWeek(now)) && minutesOfDay(now) >= timeToMinutes(shift.end) - 90);
  const installLater = installHintDismissed() && isIos() && !isInstalled();

  interface Need {
    key: string;
    short: string;
    title: string;
    href?: string;
    action?: () => void;
  }
  const needs: Need[] = [];
  if (inbox) needs.push({ key: 'inbox', short: `${inbox} ${inbox === 1 ? 'note' : 'notes'} to sort`, title: `Sort ${inbox} ${inbox === 1 ? 'note' : 'notes'} in your inbox`, href: paths.inbox });
  if (backup?.due)
    needs.push({
      key: 'backup',
      short: 'backup due',
      title: backup.daysSince === null ? 'Back up: your notebook is only on this phone' : `Back up: last one ${formatDaysAgo(backup.daysSince)}`,
      action: exportBackup,
    });
  if (kitchenId && kitchenId !== NO_KITCHEN_ID && next === null) needs.push({ key: 'services', short: 'service times', title: 'Set your service times', href: paths.kitchenServices(kitchenId) });
  if (shiftEndingSoon)
    needs.push({
      key: 'next-sheet',
      short: 'next shift’s sheet',
      title: 'Shift nearly over: write the next shift’s sheet',
      action: () => {
        const button = document.getElementById('sheet-next');
        button?.scrollIntoView({ block: 'center' });
        button?.focus();
      },
    });
  if (checkIn) needs.push({ key: 'check-in', short: 'last week’s goal', title: 'How did last week’s goal go?', href: paths.goal });
  else if (goal === undefined || (goal && !goal.text)) needs.push({ key: 'goal', short: 'this week’s goal', title: 'Set a goal for this week', href: paths.goal });
  if (installLater) needs.push({ key: 'install', short: 'add to Home Screen', title: 'Add Mep to your Home Screen', action: () => clearInstallHintDismissal() });

  if (needs.length === 0) return null;
  return (
    <>
      <button class="needs-you-line" type="button" onClick={() => setOpen(true)}>
        <span class="needs-you-line__dot" aria-hidden="true" />
        Needs you: {needs.map((n) => n.short).join(' · ')}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Needs you">
        <ul class="row-list" role="list">
          {needs.map((need) => (
            <li key={need.key}>
              {need.href ? (
                <a class="list-row" href={need.href} onClick={() => setOpen(false)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{need.title}</span>
                  </span>
                  <Icon name="chevron-right" />
                </a>
              ) : (
                <button
                  class="list-row"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    need.action?.();
                  }}
                >
                  <span class="list-row__main">
                    <span class="list-row__title">{need.title}</span>
                  </span>
                  <Icon name="chevron-right" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

/** The current time, refreshed every minute and whenever the app comes back. */
function useNow(): Date {
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

/** Changes once a day: re-run day-based queries when the date rolls over. */
function dayKey(date: Date): string {
  return date.toDateString();
}

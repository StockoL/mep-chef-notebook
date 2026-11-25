import { useEffect, useState } from 'preact/hooks';
import { getBackupStatus } from '../../data/backup';
import { getCheckInDue, getThisWeeksGoal } from '../../data/goals';
import { getNextService, getPlace, getPlaceDetails, getServiceTimesOn, listShifts, placeSectionIds } from '../../data/kitchens';
import { setTimeChange } from '../../data/events';
import { isoDayOfWeek, minutesOfDay, timeToMinutes, toCalendarDate } from '../../core/time/calendar';
import { Sheet } from '../components/Sheet';
import { trackSave } from '../saveStatus';
import { SheetPanel } from './Sheets';
import { countInbox } from '../../data/notes';
import { NO_KITCHEN_ID } from '../../data/types';
import { exportBackup } from '../backupActions';
import { InstallHint } from '../components/InstallHint';
import { formatDayAhead, formatDaysAgo } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';

/**
 * Today (UX → Today): the day, the next service (tap it to change today's
 * times), the weekly goal as one quiet line, "needs you" items only when
 * something does, and today's sheet.
 */
export function Today() {
  const now = useNow();
  const details = useLiveQuery(() => getPlaceDetails());
  const goal = useLiveQuery(() => getThisWeeksGoal(now), [dayKey(now)]);
  const day = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section class="flow">
      <InstallHint />
      <header class="flow" style={{ '--flow-space': 'var(--space-3xs)' }}>
        <h1>{day}</h1>
        {details && <NextServiceLine kitchenId={details.place.kitchenId} now={now} />}
      </header>

      <a class="goal-line" href={paths.goal}>
        {goal ? <>This week: {goal.text}</> : 'Set a goal for this week'}
      </a>

      <NeedsYou now={now} />

      {details && (
        <SheetPanel
          kitchenId={details.place.kitchenId}
          sectionIds={placeSectionIds(details.place)}
          date={toCalendarDate(now)}
          isToday
        />
      )}
      <a class="goal-line" href={paths.sheets}>
        Other days’ sheets
      </a>
    </section>
  );
}

/**
 * "Lunch is on now, last bookings 16:30" / "Next: Dinner at 18:00" (K5).
 * Tapping it opens today's times, for a one-off change (K6): 2 taps.
 */
function NextServiceLine({ kitchenId, now }: { kitchenId: string; now: Date }) {
  const minute = Math.floor(now.getTime() / 60_000);
  const next = useLiveQuery(() => getNextService(kitchenId, now), [kitchenId, minute]);
  const [open, setOpen] = useState(false);

  if (kitchenId === NO_KITCHEN_ID || next === undefined) return null;

  if (!next) {
    return (
      <p class="next-service">
        <a href={paths.kitchenServices(kitchenId)}>Set your service times</a>
      </p>
    );
  }
  const when = next.daysAhead === 0 ? '' : ` ${formatDayAhead(next.daysAhead, now)}`;
  return (
    <>
      <button class="next-service next-service__button" type="button" onClick={() => setOpen(true)}>
        {next.onNow ? (
          <>
            <strong>{next.name}</strong> is on now{next.lastBookings ? `, last bookings ${next.lastBookings}` : ''}
          </>
        ) : (
          <>
            Next: <strong>{next.name}</strong>
            {when} at {next.firstTickets}
          </>
        )}
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

/** Things that need the chef, shown only when they do (UX → Today). */
function NeedsYou({ now }: { now: Date }) {
  const inbox = useLiveQuery(() => countInbox());
  const backup = useLiveQuery(() => getBackupStatus(now), [dayKey(now)]);
  const checkIn = useLiveQuery(() => getCheckInDue(now), [dayKey(now)]);
  const place = useLiveQuery(() => getPlace());
  const shifts = useLiveQuery(async () => (place ? listShifts(place.kitchenId) : []), [place?.kitchenId]);
  // Within 90 minutes of the end of today's usual shift, or after it (SH3).
  const shiftEndingSoon = (shifts ?? []).some(
    (shift) => shift.days.includes(isoDayOfWeek(now)) && minutesOfDay(now) >= timeToMinutes(shift.end) - 90,
  );

  const items = [];
  if (backup?.due) {
    items.push(
      <li key="backup" class="needs-you__item" data-status="warning">
        <span>
          {backup.daysSince === null
            ? 'Your notebook is only on this phone. Back it up.'
            : `Last backup ${formatDaysAgo(backup.daysSince)}. Back up now.`}
        </span>
        <button class="button" type="button" data-variant="primary" onClick={exportBackup}>
          Back up
        </button>
      </li>,
    );
  }
  if (inbox) {
    items.push(
      <li key="inbox">
        <a class="needs-you__item" href={paths.inbox}>
          <span>
            {inbox} {inbox === 1 ? 'note' : 'notes'} to sort
          </span>
          <Icon name="chevron-right" />
        </a>
      </li>,
    );
  }
  if (shiftEndingSoon) {
    items.push(
      <li key="next-sheet">
        <button
          class="needs-you__item"
          type="button"
          onClick={() => {
            const button = document.getElementById('sheet-next');
            button?.scrollIntoView({ block: 'center' });
            button?.focus();
          }}
        >
          <span>Shift nearly over: write the next shift’s sheet.</span>
          <Icon name="chevron-down" />
        </button>
      </li>,
    );
  }
  if (checkIn) {
    items.push(
      <li key="goal">
        <a class="needs-you__item" href={paths.goal}>
          <span>How did last week’s goal go?</span>
          <Icon name="chevron-right" />
        </a>
      </li>,
    );
  }

  if (items.length === 0) return null;
  return (
    <section aria-label="Needs you">
      <ul class="needs-you flow" role="list" style={{ '--flow-space': 'var(--space-2xs)' }}>
        {items}
      </ul>
    </section>
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

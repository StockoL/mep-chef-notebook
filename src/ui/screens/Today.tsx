import { useEffect, useState } from 'preact/hooks';
import { getBackupStatus } from '../../data/backup';
import { getCheckInDue, getThisWeeksGoal } from '../../data/goals';
import { getNextService, getPlaceDetails } from '../../data/kitchens';
import { countInbox } from '../../data/notes';
import { NO_KITCHEN_ID } from '../../data/types';
import { exportBackup } from '../backupActions';
import { InstallHint } from '../components/InstallHint';
import { formatDayAhead, formatDaysAgo } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';

/**
 * Today (UX → Today): the day, the next service, the weekly goal as one quiet
 * line, and "needs you" items only when something does. The sheet itself
 * arrives in Phase 3.
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

      <div class="empty-state flow">
        <p>Today's sheet will appear here.</p>
        <p class="empty-state__hint">
          To jot something down, tap the bar below. <Icon name="chevron-down" size="s" />
        </p>
      </div>
    </section>
  );
}

/** "Lunch is on now, until 16:30" / "Next: Dinner at 18:00" (K5). */
function NextServiceLine({ kitchenId, now }: { kitchenId: string; now: Date }) {
  const minute = Math.floor(now.getTime() / 60_000);
  const next = useLiveQuery(() => getNextService(kitchenId, now), [kitchenId, minute]);

  if (kitchenId === NO_KITCHEN_ID || next === undefined) return null;

  if (!next) {
    return (
      <p class="next-service">
        <a href={paths.kitchenServices(kitchenId)}>Set your service times</a>
      </p>
    );
  }
  if (next.onNow) {
    return (
      <p class="next-service">
        <strong>{next.name}</strong> is on now{next.lastBookings ? `, last bookings ${next.lastBookings}` : ''}
      </p>
    );
  }
  const when = next.daysAhead === 0 ? '' : ` ${formatDayAhead(next.daysAhead, now)}`;
  return (
    <p class="next-service">
      Next: <strong>{next.name}</strong>
      {when} at {next.firstTickets}
    </p>
  );
}

/** Things that need the chef, shown only when they do (UX → Today). */
function NeedsYou({ now }: { now: Date }) {
  const inbox = useLiveQuery(() => countInbox());
  const backup = useLiveQuery(() => getBackupStatus(now), [dayKey(now)]);
  const checkIn = useLiveQuery(() => getCheckInDue(now), [dayKey(now)]);

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

import { useLocation } from 'preact-iso';
import { useId, useState } from 'preact/hooks';
import { toCalendarDate } from '../../core/time/calendar';
import { addEventService, createEvent, deleteEvent, getEvent, listEvents, removeEventService, updateEvent, updateEventService } from '../../data/events';
import { getKitchen, listServices } from '../../data/kitchens';
import { ListError } from '../../data/lists';
import { restoreSnapshot } from '../../data/snapshot';
import type { EventService } from '../../data/types';
import { ChipChoice } from '../components/Controls';
import { DoneFooter, ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { formatCalendarDate } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { Hint } from '../components/Hint';

/** A kitchen's events from today on (K6): /kitchen/:id/events */
export function Events({ id = '' }: { id?: string }) {
  const kitchen = useLiveQuery(() => getKitchen(id), [id]);
  const events = useLiveQuery(() => listEvents(id, toCalendarDate(new Date())), [id]);
  const [name, setName] = useState('');
  const [date, setDate] = useState(toCalendarDate(new Date()));
  const [error, setError] = useState('');
  const { route } = useLocation();

  async function add(event: Event) {
    event.preventDefault();
    try {
      const eventId = await createEvent(id, date, name);
      route(paths.event(id, eventId));
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add it.');
    }
  }

  return (
    <section class="flow">
      <ScreenHeader title="Events" back={{ href: paths.kitchen(id), label: kitchen?.name ?? 'Kitchen' }} />
      <Hint name="events">Weddings, functions and one-off time changes.</Hint>
      <ul class="row-list" role="list">
        {events?.map(({ event, services }) => (
          <li key={event.id}>
            <a class="list-row" href={paths.event(id, event.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{event.name}</span>
                <span class="list-row__meta">
                  {[formatCalendarDate(event.date), event.covers ? `${event.covers} covers` : '', services.map((s) => `${s.name} ${s.start}`).join(', ')]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Icon name="chevron-right" />
            </a>
          </li>
        ))}
      </ul>
      {events?.length === 0 && <div class="empty-state"><p>No events coming up.</p></div>}

      <form class="card" onSubmit={add}>
        <div class="card__body flow">
          <h2 class="section-label">Add an event</h2>
          <div class="field">
            <label class="label" for="event-name">Name</label>
            <input class="input" id="event-name" value={name} placeholder="Smith wedding" autocomplete="off" onInput={(e) => setName(e.currentTarget.value)} />
          </div>
          <div class="field">
            <label class="label" for="event-date">Date</label>
            <input class="input" id="event-date" type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} />
          </div>
          {error && <p class="field__error">{error}</p>}
          <button class="button" type="submit" data-variant="primary" disabled={!name.trim() || !date}>
            Add event
          </button>
        </div>
      </form>
    </section>
  );
}

/** One event: date, covers, notes, what it replaces, its service times. */
export function EventEditor({ id = '', eventId = '' }: { id?: string; eventId?: string }) {
  const details = useLiveQuery(() => getEvent(eventId), [eventId]);
  const services = useLiveQuery(() => listServices(id), [id]);
  const { route } = useLocation();
  if (!details) return <ScreenHeader title="" back={{ href: paths.events(id), label: 'Events' }} />;
  const { event } = details;

  async function remove() {
    const snapshot = await deleteEvent(eventId);
    route(paths.events(id));
    showMessage(`Deleted ${event.name}.`, () => restoreSnapshot(snapshot));
  }

  return (
    <section class="flow" key={eventId}>
      <ScreenHeader title={event.name} back={{ href: paths.events(id), label: 'Events' }} />
      <TextField label="Name" value={event.name} onSave={(name) => updateEvent(eventId, { name })} />
      <div class="field">
        <label class="label" for="ev-date">Date</label>
        <input class="input" id="ev-date" type="date" value={event.date} onInput={(e) => e.currentTarget.value && trackSave(updateEvent(eventId, { date: e.currentTarget.value }))} />
      </div>
      <TextField
        label="Covers"
        value={event.covers === null ? '' : String(event.covers)}
        inputMode="numeric"
        onSave={(text) => {
          const n = parseInt(text, 10);
          return updateEvent(eventId, { covers: Number.isFinite(n) ? n : null });
        }}
      />
      <TextField label="Notes" value={event.notes} onSave={(notes) => updateEvent(eventId, { notes })} />
      {services && (
        <ChipChoice
          label="Replaces a usual service that day"
          choices={services.filter((s) => !s.hidden).map((s) => ({ value: s.id, label: s.name }))}
          value={event.replacesServiceId}
          onChange={(replacesServiceId) => trackSave(updateEvent(eventId, { replacesServiceId }))}
          allowNone
        />
      )}
      <p class="field__hint">{event.replacesServiceId ? 'That service’s usual times are replaced by these.' : 'Runs alongside the usual services.'}</p>

      <h2 class="section-label">Service times</h2>
      {details.services.map((s) => (
        <EventServiceRow key={s.id} service={s} />
      ))}
      <button class="button" type="button" onClick={() => trackSave(addEventService(eventId, details.services.length ? 'Service' : event.name, '18:00'))}>
        Add a service time
      </button>
      <DoneFooter href={paths.events(id)} />
      <button class="button" type="button" data-variant="danger" onClick={remove}>
        Delete event
      </button>
    </section>
  );
}

function EventServiceRow({ service }: { service: EventService }) {
  const id = useId();
  return (
    <div class="card">
      <div class="card__body flow">
        <TextField label="Called" value={service.name} onSave={(name) => updateEventService(service.id, { name })} />
        <div class="cluster">
          <div class="field">
            <label class="label" for={`${id}-start`}>Starts</label>
            <input class="input" id={`${id}-start`} type="time" value={service.start} onInput={(e) => e.currentTarget.value && trackSave(updateEventService(service.id, { start: e.currentTarget.value }))} />
          </div>
          <div class="field">
            <label class="label" for={`${id}-end`}>Ends</label>
            <input class="input" id={`${id}-end`} type="time" value={service.end ?? ''} onInput={(e) => trackSave(updateEventService(service.id, { end: e.currentTarget.value || null }))} />
          </div>
        </div>
        <button class="button" type="button" data-variant="ghost" onClick={() => trackSave(removeEventService(service.id))}>
          Remove this time
        </button>
      </div>
    </div>
  );
}

function TextField(props: { label: string; value: string; inputMode?: 'numeric'; onSave: (value: string) => Promise<void> }) {
  const id = useId();
  const [text, setText] = useState(props.value);
  return (
    <div class="field">
      <label class="label" for={id}>{props.label}</label>
      <input
        class="input"
        id={id}
        value={text}
        inputMode={props.inputMode}
        onInput={(e) => setText(e.currentTarget.value)}
        onBlur={() => text !== props.value && trackSave(props.onSave(text))}
      />
    </div>
  );
}

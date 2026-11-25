import { useId, useState } from 'preact/hooks';
import {
  createKitchen,
  getKitchen,
  getPlace,
  listKitchens,
  listServices,
  listShifts,
  renameKitchen,
  setKitchenArchived,
  setPlace,
  setUsualSection,
  addShift,
  updateShift,
  deleteShift,
  getService,
  updateService,
} from '../../data/kitchens';
import { ListError } from '../../data/lists';
import { listKitchenNotes } from '../../data/notes';
import { NO_KITCHEN_ID, type DayOfWeek, type ServiceWindow } from '../../data/types';
import { ChipToggles, Switch } from '../components/Controls';
import { ListEditor } from '../components/ListEditor';
import { DoneFooter, ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { DAY_NAMES, formatDays } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

const DAY_CHOICES = DAY_NAMES.map((label, i) => ({ value: (i + 1) as DayOfWeek, label }));

// ─── All kitchens ─────────────────────────────────────────────────────────

/** Every kitchen, including archived ones (K3), and adding a new one. */
export function Kitchens() {
  const kitchens = useLiveQuery(() => listKitchens());
  const place = useLiveQuery(() => getPlace());
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function add(event: Event) {
    event.preventDefault();
    try {
      const id = await createKitchen(name);
      setName('');
      setError('');
      await setPlace(id, null);
      showMessage(`Added ${name.trim()}. You’re there now.`);
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t add that kitchen.');
    }
  }

  return (
    <section class="flow">
      <ScreenHeader title="Kitchens" />
      <ul class="row-list" role="list">
        {kitchens?.map((kitchen) => (
          <li key={kitchen.id}>
            <a class="list-row" href={kitchen.builtIn ? undefined : paths.kitchen(kitchen.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{kitchen.name}</span>
                <span class="list-row__meta">
                  {kitchen.id === place?.kitchenId ? 'You’re here' : kitchen.archived ? 'Archived' : ''}
                  {kitchen.builtIn ? 'Uses your own variations, no setup' : ''}
                </span>
              </span>
              {!kitchen.builtIn && <Icon name="chevron-right" />}
            </a>
          </li>
        ))}
      </ul>
      <form class="field" onSubmit={add}>
        <label class="label" for="kitchen-name">
          New kitchen
        </label>
        <div class="input-group">
          <input class="input" id="kitchen-name" value={name} autocomplete="off" onInput={(e) => setName(e.currentTarget.value)} />
          <button class="button" type="submit" disabled={!name.trim()}>
            Add
          </button>
        </div>
        {error && <p class="field__error">{error}</p>}
      </form>
    </section>
  );
}

// ─── One kitchen ──────────────────────────────────────────────────────────

/** Kitchen settings (UX → Kitchen settings): /kitchen/:id */
export function KitchenSettings({ id = '' }: { id?: string }) {
  const kitchen = useLiveQuery(() => getKitchen(id), [id]);
  const notes = useLiveQuery(() => listKitchenNotes(id), [id]);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!kitchen || kitchen.id === NO_KITCHEN_ID) return <ScreenHeader title="" back={{ href: paths.kitchens, label: 'Kitchens' }} />;

  async function saveName() {
    if (name === null || name.trim() === kitchen!.name) return;
    try {
      await trackSave(renameKitchen(id, name));
      setError('');
    } catch (e) {
      setError(e instanceof ListError ? e.message : 'Couldn’t rename it.');
    }
  }

  async function toggleArchived() {
    await setKitchenArchived(id, !kitchen!.archived);
    showMessage(kitchen!.archived ? `${kitchen!.name} is back.` : `${kitchen!.name} archived. Its notes are kept.`);
  }

  const parts = [
    { href: paths.notesFor(id), label: 'Kitchen notes', meta: notes?.length ? String(notes.length) : undefined },
    { href: paths.kitchenSections(id), label: 'Sections' },
    { href: paths.kitchenServices(id), label: 'Services and shift' },
    { href: paths.events(id), label: 'Events' },
    { href: paths.kitchenPart(id, 'equipment'), label: 'Equipment' },
    { href: paths.kitchenPart(id, 'suppliers'), label: 'Suppliers' },
    { href: paths.kitchenPart(id, 'house-rules'), label: 'House rules' },
  ];

  return (
    <section class="flow">
      <ScreenHeader title={kitchen.name} back={{ href: paths.kitchens, label: 'Kitchens' }} />
      <div class="field">
        <label class="label" for="kitchen-rename">
          Name
        </label>
        <input
          class="input"
          id="kitchen-rename"
          value={name ?? kitchen.name}
          enterkeyhint="done"
          onInput={(e) => setName(e.currentTarget.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {error && <p class="field__error">{error}</p>}
      </div>

      <ul class="row-list" role="list">
        {parts.map((part) => (
          <li key={part.href}>
            <a class="list-row" href={part.href}>
              <span class="list-row__main">
                <span class="list-row__title">{part.label}</span>
              </span>
              {'meta' in part && part.meta && <span class="list-row__meta">{part.meta}</span>}
              <Icon name="chevron-right" />
            </a>
          </li>
        ))}
      </ul>


      <button class="button" type="button" onClick={toggleArchived}>
        {kitchen.archived ? 'Bring back from archive' : 'Archive this kitchen'}
      </button>
      <p class="field__hint">Archiving keeps its notes and recipes, out of the way.</p>
    </section>
  );
}

/** A kitchen's sections: /kitchen/:id/sections */
export function KitchenSections({ id = '' }: { id?: string }) {
  const kitchen = useLiveQuery(() => getKitchen(id), [id]);
  if (!kitchen) return null;
  return (
    <section class="flow">
      <ScreenHeader title="Sections" back={{ href: paths.kitchen(id), label: kitchen.name }} />
      <ListEditor
        listRef={{ kind: 'sections', kitchenId: id }}
        itemName="section"
        usual={{ id: kitchen.usualSectionId ?? null, set: (sectionId) => setUsualSection(id, sectionId) }}
      />
    </section>
  );
}

/** A kitchen's services and the chef's shift (K5): /kitchen/:id/services */
export function KitchenServices({ id = '' }: { id?: string }) {
  const kitchen = useLiveQuery(() => getKitchen(id), [id]);
  const services = useLiveQuery(() => listServices(id), [id]);
  const shifts = useLiveQuery(() => listShifts(id), [id]);
  if (!kitchen) return null;

  return (
    <section class="flow">
      <ScreenHeader title="Services and shift" back={{ href: paths.kitchen(id), label: kitchen.name }} />

      <h2>Services</h2>
      <ul class="row-list" role="list">
        {services
          ?.filter((s) => !s.hidden)
          .map((service) => (
            <li key={service.id}>
              <a class="list-row" href={paths.service(id, service.id)}>
                <span class="list-row__main">
                  <span class="list-row__title">{service.name}</span>
                  <span class="list-row__meta">
                    {service.windows.length === 0
                      ? 'No times yet'
                      : service.windows.map((w) => `${formatDays(w.days)} ${w.firstTickets ?? '?'}–${w.lastBookings ?? '?'}`).join('; ')}
                    {service.iWorkThis ? '' : ' · Not working it'}
                  </span>
                </span>
                <Icon name="chevron-right" />
              </a>
            </li>
          ))}
      </ul>

      <details class="flow">
        <summary class="button">Rename, reorder or add services</summary>
        <ListEditor listRef={{ kind: 'services', kitchenId: id }} itemName="service" />
      </details>

      <h2>Your usual shift</h2>
      {shifts?.map((shift) => (
        <div key={shift.id} class="card">
          <div class="card__body flow">
            <div class="cluster">
              <TimeField label="Start" value={shift.start} onChange={(start) => start && trackSave(updateShift(shift.id, { start }))} />
              <TimeField label="End" value={shift.end} onChange={(end) => end && trackSave(updateShift(shift.id, { end }))} />
            </div>
            <ChipToggles label="Days" choices={DAY_CHOICES} values={shift.days} onChange={(days) => trackSave(updateShift(shift.id, { days }))} />
            <button class="button" type="button" data-variant="ghost" onClick={() => trackSave(deleteShift(shift.id))}>
              Remove this shift
            </button>
          </div>
        </div>
      ))}
      <button class="button" type="button" onClick={() => trackSave(addShift(id))}>
        {shifts?.length ? 'Add a shift for other days' : 'Add your usual shift'}
      </button>
      <DoneFooter href={paths.kitchen(id)} />
    </section>
  );
}

/** One service's times, which can differ by day: /kitchen/:id/services/:serviceId */
export function ServiceTimes({ id = '', serviceId = '' }: { id?: string; serviceId?: string }) {
  const service = useLiveQuery(() => getService(serviceId), [serviceId]);
  if (!service) return null;

  const setWindow = (index: number, changes: Partial<ServiceWindow>) =>
    trackSave(updateService(serviceId, { windows: service.windows.map((w, i) => (i === index ? { ...w, ...changes } : w)) }));
  const addWindow = () =>
    trackSave(updateService(serviceId, {
      windows: [
        ...service.windows,
        { days: service.windows.length ? [] : [1, 2, 3, 4, 5, 6, 7], firstTickets: null, lastBookings: null, usualFinish: null },
      ],
    }));
  const removeWindow = (index: number) =>
    trackSave(updateService(serviceId, { windows: service.windows.filter((_, i) => i !== index) }));

  return (
    <section class="flow">
      <ScreenHeader title={service.name} back={{ href: paths.kitchenServices(id), label: 'Services' }} />
      <Switch checked={service.iWorkThis} onChange={(iWorkThis) => trackSave(updateService(serviceId, { iWorkThis }))}>
        I work this service
      </Switch>

      {service.windows.map((window, index) => (
        <div key={index} class="card">
          <div class="card__body flow">
            <ChipToggles label="Days" choices={DAY_CHOICES} values={window.days} onChange={(days) => setWindow(index, { days })} />
            <div class="cluster">
              <TimeField label="First tickets" value={window.firstTickets} onChange={(firstTickets) => setWindow(index, { firstTickets })} />
              <TimeField label="Last bookings" value={window.lastBookings} onChange={(lastBookings) => setWindow(index, { lastBookings })} />
              <TimeField label="Usual finish" value={window.usualFinish} onChange={(usualFinish) => setWindow(index, { usualFinish })} />
            </div>
            <button class="button" type="button" data-variant="ghost" onClick={() => removeWindow(index)}>
              Remove these times
            </button>
          </div>
        </div>
      ))}
      <button class="button" type="button" onClick={addWindow}>
        {service.windows.length ? 'Add different times for other days' : 'Add times'}
      </button>
      <DoneFooter href={paths.kitchenServices(id)} />
    </section>
  );
}

/** A native time picker: the phone's own wheel, large and quick. */
function TimeField(props: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  const id = useId();
  return (
    <div class="field">
      <label class="label" for={id}>
        {props.label}
      </label>
      <input
        class="input"
        id={id}
        type="time"
        value={props.value ?? ''}
        onInput={(e) => props.onChange(e.currentTarget.value || null)}
      />
    </div>
  );
}

/** Equipment, suppliers and house rules: screens filled in by later phases. */
export function KitchenPart({ id = '', part = '' }: { id?: string; part?: string }) {
  const kitchen = useLiveQuery(() => getKitchen(id), [id]);
  const copy: Record<string, { title: string; text: string }> = {
    equipment: { title: 'Equipment', text: 'Ovens, hobs and the rest arrive with the prep plan, which uses them to avoid clashes.' },
    suppliers: { title: 'Suppliers', text: 'Suppliers arrive with section admin, for draft orders and cut-off times.' },
    'house-rules': { title: 'House rules', text: 'Shelf lives and label rules arrive with food safety.' },
  };
  const page = copy[part] ?? { title: 'Not found', text: '' };
  return (
    <section class="flow">
      <ScreenHeader title={page.title} back={{ href: paths.kitchen(id), label: kitchen?.name ?? 'Kitchen' }} />
      <div class="empty-state">
        <p>{page.text}</p>
      </div>
    </section>
  );
}

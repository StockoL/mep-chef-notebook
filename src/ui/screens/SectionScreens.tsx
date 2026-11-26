import { useState } from 'preact/hooks';
import { isoWeek } from '../../core/time/calendar';
import { getCheckInDue, getGoal, listGoals, setGoalText, setReflection } from '../../data/goals';
import { getListItems } from '../../data/lists';
import { listWaste } from '../../data/waste';
import { goalSuggestions } from '../../data/report';
import { listBatches } from '../../data/foodSafety';
import { getPlace } from '../../data/kitchens';
import { BatchLabelView } from '../components/FoodSafety';
import { Sheet } from '../components/Sheet';
import { ChipChoice } from '../components/Controls';
import { ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { WasteSheet } from '../components/WasteSheet';
import { formatCalendarDate } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

interface HubLink {
  href: string;
  label: string;
  meta?: string;
}

/**
 * Section tab, in two groups (DECISIONS 54): what's used on shift, then the
 * admin done once a day or a week. Money has its own screen.
 */
export function Section() {
  const [logging, setLogging] = useState(false);
  const onShift: HubLink[] = [
    { href: paths.sectionList, label: 'Section lists', meta: 'Standing items and pars' },
    { href: paths.checklists, label: 'Opening and closing checks' },
    { href: paths.labels, label: 'Batches and labels' },
    { href: paths.waste, label: 'Waste log' },
  ];
  const admin: HubLink[] = [
    { href: paths.count, label: 'Count', meta: 'Against pars' },
    { href: paths.orders, label: 'Draft orders', meta: 'What’s below par, by supplier' },
    { href: paths.money, label: 'Money', meta: 'GP, prices, recipe costs, stock and waste' },
    { href: paths.goal, label: 'Weekly goal' },
    { href: paths.report, label: 'Weekly report', meta: 'One page, to print or save as PDF' },
  ];
  return (
    <section class="flow">
      <h1>Section</h1>
      {/* Waste moved here from the capture bar: it's logged at the end of a shift. */}
      <button class="button" type="button" data-variant="primary" onClick={() => setLogging(true)}>
        <Icon name="bin" /> Log waste
      </button>
      <WasteSheet open={logging} onClose={() => setLogging(false)} />
      <HubLinks title="On shift" links={onShift} />
      <HubLinks title="Admin" links={admin} />
    </section>
  );
}

function HubLinks({ title, links }: { title: string; links: HubLink[] }) {
  const id = `hub-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section class="flow" aria-labelledby={id} style={{ '--flow-space': 'var(--space-2xs)' }}>
      <h2 id={id} class="used-in__label">
        {title}
      </h2>
      <ul class="row-list" role="list">
        {links.map((link) => (
          <li key={link.href}>
            <a class="list-row" href={link.href}>
              <span class="list-row__main">
                <span class="list-row__title">{link.label}</span>
                {link.meta && <span class="list-row__meta">{link.meta}</span>}
              </span>
              <Icon name="chevron-right" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The waste log (A4): everything logged, newest first. Tap an entry to correct or delete it. */
export function WasteLog() {
  const entries = useLiveQuery(() => listWaste());
  const reasons = useLiveQuery(() => getListItems({ kind: 'values', list: 'waste-reasons', kitchenId: null }));
  const [logging, setLogging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = entries?.find((e) => e.id === editingId);
  const reasonName = (id: string | null) => reasons?.find((r) => r.id === id)?.name;

  return (
    <section class="flow">
      <ScreenHeader title="Waste log" back={{ href: paths.section, label: 'Section' }} />
      <button class="button" type="button" data-variant="primary" onClick={() => setLogging(true)}>
        Log waste
      </button>
      {entries?.length === 0 && (
        <div class="empty-state">
          <p>Nothing logged yet. “Log waste” above logs it in a few taps.</p>
        </div>
      )}
      <ul class="row-list" role="list">
        {entries?.map((entry) => (
          <li key={entry.id}>
            <button class="list-row" type="button" onClick={() => setEditingId(entry.id)}>
              <span class="list-row__main">
                <span class="list-row__title">
                  {entry.text}
                  {entry.quantity && ` · ${entry.quantity.amount} ${entry.quantity.unit === 'portion' ? 'portions' : entry.quantity.unit}`}
                </span>
                <span class="list-row__meta">
                  {[formatCalendarDate(entry.date), reasonName(entry.reasonId)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
      <WasteSheet open={logging} onClose={() => setLogging(false)} />
      <WasteSheet open={!!editing} entry={editing} onClose={() => setEditingId(null)} />
    </section>
  );
}

/** The weekly goal (G1): this week's, last week's check-in, and the history. */
export function Goal() {
  const week = isoWeek(new Date());
  const goal = useLiveQuery(() => getGoal(week), [week]);
  const checkIn = useLiveQuery(() => getCheckInDue());
  const history = useLiveQuery(() => listGoals());
  const [text, setText] = useState<string | null>(null);

  return (
    <section class="flow">
      <ScreenHeader title="Weekly goal" back={{ href: paths.section, label: 'Section' }} />

      {checkIn && (
        <div class="card">
          <div class="card__body flow">
            <h2>How did last week go?</h2>
            <p>{checkIn.text}</p>
            <ChipChoice
              label="Last week’s goal"
              choices={['Went well', 'Partly', 'Didn’t happen'].map((v) => ({ value: v, label: v }))}
              value={null}
              onChange={async (value) => {
                if (!value) return;
                await trackSave(setReflection(checkIn.week, value));
                showMessage('Thanks. Last week’s goal is in your history.');
              }}
            />
          </div>
        </div>
      )}

      <div class="field">
        <label class="label" for="goal-text">
          This week, in your own words
        </label>
        <input
          class="input"
          id="goal-text"
          value={text ?? goal?.text ?? ''}
          placeholder="Label everything before service"
          enterkeyhint="done"
          onInput={(e) => {
            setText(e.currentTarget.value);
            void trackSave(setGoalText(week, e.currentTarget.value));
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <p class="field__hint">Shown as one quiet line on Today. Saved as you type.</p>
      </div>
      <GoalSuggestions
        onUse={async (suggestion) => {
          setText(suggestion);
          await trackSave(setGoalText(week, suggestion));
        }}
      />

      {history && history.filter((g) => g.week !== week).length > 0 && (
        <section class="flow" aria-labelledby="goal-history">
          <h2 id="goal-history">Past weeks</h2>
          <ul class="row-list" role="list">
            {history
              .filter((g) => g.week !== week)
              .map((g) => (
                <li key={g.id} class="list-row" data-static>
                  <span class="list-row__main">
                    <span class="list-row__title">{g.text}</span>
                    <span class="list-row__meta">
                      Week {g.week.split('-W')[1]} · {g.reflection ?? 'No check-in'}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </section>
  );
}

/** Batches made in this kitchen, newest first, each opening its label (FS2). /section/labels */
export function Labels() {
  const place = useLiveQuery(() => getPlace());
  const batches = useLiveQuery(async () => (place ? listBatches(place.kitchenId) : []), [place?.kitchenId]);
  const [open, setOpen] = useState<string | null>(null);
  const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <section class="flow">
      <ScreenHeader title="Batches and labels" back={{ href: paths.section, label: 'Section' }} />
      <p class="field__hint">Tap “Made” on a sheet item or a recipe to label a batch.</p>
      {batches?.length === 0 && (
        <div class="empty-state">
          <p>Nothing labelled yet.</p>
        </div>
      )}
      <ul class="row-list" role="list">
        {batches?.map(({ batch, name }) => (
          <li key={batch.id}>
            <button class="list-row" type="button" onClick={() => setOpen(batch.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{name}</span>
                <span class="list-row__meta">
                  Made {when(batch.madeAt)}
                  {batch.useBy ? ` · use by ${when(batch.useBy)}` : ''}
                </span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title="Label">
        {open && <BatchLabelView batchId={open} onDeleted={() => setOpen(null)} />}
      </Sheet>
    </section>
  );
}

/** Goals the last week's patterns suggest (G1): the chef chooses, or writes their own. */
function GoalSuggestions({ onUse }: { onUse: (text: string) => void }) {
  const place = useLiveQuery(() => getPlace());
  const suggestions = useLiveQuery(async () => (place ? goalSuggestions(place.kitchenId) : []), [place?.kitchenId]);
  if (!suggestions?.length) return null;
  return (
    <section class="flow" aria-labelledby="goal-ideas" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <h2 id="goal-ideas" class="used-in__label">
        Ideas from last week
      </h2>
      <ul class="row-list" role="list">
        {suggestions.map((s) => (
          <li key={s.text}>
            <button class="list-row" type="button" onClick={() => onUse(s.text)}>
              <span class="list-row__main">
                <span class="list-row__title">{s.text}</span>
                <span class="list-row__meta">{s.from}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

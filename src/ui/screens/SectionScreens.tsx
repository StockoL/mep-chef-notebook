import { useState } from 'preact/hooks';
import { isoWeek } from '../../core/time/calendar';
import { getCheckInDue, getGoal, listGoals, setGoalText, setReflection } from '../../data/goals';
import { getListItems } from '../../data/lists';
import { listWaste } from '../../data/waste';
import { ChipChoice } from '../components/Controls';
import { ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { WasteSheet } from '../components/WasteSheet';
import { formatCalendarDate } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

/** Section tab: the chef's station admin. Stock, pars and checklists arrive in Phase 11. */
export function Section() {
  const links = [
    { href: paths.sectionList, label: 'Section list' },
    { href: paths.waste, label: 'Waste log' },
    { href: paths.goal, label: 'Weekly goal' },
  ];
  return (
    <section class="flow">
      <h1>Section</h1>
      <ul class="row-list" role="list">
        {links.map((link) => (
          <li key={link.href}>
            <a class="list-row" href={link.href}>
              <span class="list-row__main">
                <span class="list-row__title">{link.label}</span>
              </span>
              <Icon name="chevron-right" />
            </a>
          </li>
        ))}
      </ul>
      <p class="field__hint">Stock counts, checklists and orders come later.</p>
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
          <p>Nothing logged yet. The bin on the capture bar logs waste in a few taps.</p>
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

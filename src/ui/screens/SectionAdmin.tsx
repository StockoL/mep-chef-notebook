import { useLocation } from 'preact-iso';
import { useState } from 'preact/hooks';
import { ALLERGENS } from '../../core/allergens/allergens';
import { formatPence } from '../../core/costing/costing';
import { toCalendarDate } from '../../core/time/calendar';
import {
  addChecklistItem,
  checklistHistory,
  findChecklist,
  getRun,
  moveChecklistItem,
  removeChecklistItem,
  restoreChecklistItem,
  toggleTick,
  type ChecklistKind,
} from '../../data/checklists';
import { getKitchen, getPlace, listSections } from '../../data/kitchens';
import { getMenu } from '../../data/menus';
import { allergenMatrix, matrixCsv, weeklyReport } from '../../data/report';
import { getChosenSection, setChosenSection } from '../../data/sectionItems';
import { draftOrders, getCountView, orderText, setCount, type CountRow } from '../../data/stock';
import type { Id, KitchenId } from '../../data/types';
import { Segmented } from '../components/Controls';
import { ScreenHeader } from '../components/ScreenHeader';
import { showMessage } from '../components/UndoBar';
import { formatCalendarDate } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { saveFile, shareText } from '../saveFile';
import { trackSave } from '../saveStatus';
import { Hint } from '../components/Hint';

/** Section chips (any section, the last one used first: DECISIONS 48). */
function SectionChooser({ kitchenId, value }: { kitchenId: KitchenId; value: Id | null }) {
  const sections = useLiveQuery(async () => (await listSections(kitchenId)).filter((s) => !s.hidden), [kitchenId]);
  if (!sections || sections.length < 2) return null;
  return (
    <div class="reel" role="region" aria-label="Section" tabIndex={0}>
      {sections.map((s) => (
        <button key={s.id} class="chip" type="button" aria-pressed={s.id === value} onClick={() => setChosenSection(kitchenId, s.id)}>
          {s.name}
        </button>
      ))}
    </div>
  );
}

function useSection() {
  const place = useLiveQuery(() => getPlace());
  const kitchenId = place?.kitchenId;
  const sectionId = useLiveQuery(async () => (kitchenId ? getChosenSection(kitchenId) : null), [kitchenId]) ?? null;
  return { kitchenId, sectionId };
}

// ─── Count (A2) ───────────────────────────────────────────────────────────

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

/**
 * Counting a section (A2): items in shelf order, a large number pad, Next
 * saves and moves on. Shows what's below par and what the stock is worth.
 * Common path: per item, the digits then Next.
 */
export function Count() {
  const { kitchenId, sectionId } = useSection();
  const view = useLiveQuery(async () => (sectionId && kitchenId ? getCountView(sectionId, kitchenId) : undefined), [sectionId, kitchenId]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState<string | null>(null);
  const back = { href: paths.section, label: 'Section' };
  if (!kitchenId || !view || !sectionId) return <ScreenHeader title="Count" back={back} />;

  const rows = view.rows;
  const current = rows[index];
  const shown = typed ?? (current?.count ? String(current.count.amount) : '');
  const unit = (row: CountRow) => row.view.item.par?.unit ?? 'each';

  async function next() {
    if (!current || !sectionId) return;
    const amount = Number(shown);
    if (typed !== null) await trackSave(setCount(sectionId, current.view.item.id, shown.trim() && Number.isFinite(amount) ? { amount, unit: unit(current) } : null));
    setTyped(null);
    setIndex(Math.min(index + 1, rows.length));
  }

  const below = rows.filter((r) => (r.short ?? 0) > 0);
  return (
    <section class="flow">
      <ScreenHeader title="Count" back={back} />
      <SectionChooser kitchenId={kitchenId} value={sectionId} />
      {rows.length === 0 && (
        <div class="empty-state">
          <p>Nothing on this section’s list to count. Add items with pars in Section → Section lists.</p>
        </div>
      )}
      {current && (
        <article class="count-current">
          <p class="list-row__meta">
            {index + 1} of {rows.length}
            {current.view.item.shelfPosition ? ` · ${current.view.item.shelfPosition}` : ''}
          </p>
          <h1 class="count-current__name">{current.view.name}</h1>
          <p class="count-current__value" aria-live="polite">
            {shown || '–'} <span class="count-current__unit">{unit(current)}</span>
          </p>
          {current.view.item.par && <p class="field__hint">Par {current.view.item.par.amount}{unit(current)}</p>}
          <div class="keypad" role="group" aria-label="Number pad">
            {KEYS.map((key) => (
              <button
                key={key}
                class="keypad__key"
                type="button"
                aria-label={key === '⌫' ? 'Delete' : key}
                onClick={() => setTyped(key === '⌫' ? shown.slice(0, -1) : shown.includes('.') && key === '.' ? shown : `${typed === null ? '' : shown}${key}`)}
              >
                {key}
              </button>
            ))}
          </div>
          <div class="cluster">
            <button class="button" type="button" disabled={index === 0} onClick={() => { setTyped(null); setIndex(index - 1); }}>
              Back
            </button>
            <button class="button count-current__next" type="button" data-variant="primary" onClick={next}>
              {index === rows.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </article>
      )}
      {!current && rows.length > 0 && (
        <section class="flow" aria-labelledby="count-done">
          <h2 class="section-label" id="count-done">Counted</h2>
          <h3 class="section-label">Below par ({below.length})</h3>
          <ul class="row-list" role="list">
            {below.map((r) => (
              <li key={r.view.item.id} class="list-row" data-static>
                <span class="list-row__main">
                  <span class="list-row__title">{r.view.name}</span>
                  <span class="list-row__meta">
                    {r.short}
                    {unit(r)} short of {r.view.item.par?.amount}
                    {unit(r)}
                    {r.suggestion ? ` · ${r.suggestion.reason} Try a par of ${r.suggestion.par}${unit(r)}.` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div class="cluster">
            <a class="button" data-variant="primary" href={paths.orders}>
              Draft orders
            </a>
            <button class="button" type="button" onClick={() => setIndex(0)}>
              Count again
            </button>
          </div>
          <Hint name="count-topup">Components below par go on the next shift’s sheet when you write it.</Hint>
        </section>
      )}
    </section>
  );
}

// ─── Draft orders (A3) ────────────────────────────────────────────────────

/** Below-par ingredients as draft orders by supplier, with cut-offs. Drafts only: you send them, never the app. */
export function Orders() {
  const place = useLiveQuery(() => getPlace());
  const kitchen = useLiveQuery(async () => (place ? getKitchen(place.kitchenId) : undefined), [place?.kitchenId]);
  const orders = useLiveQuery(async () => (place ? draftOrders(place.kitchenId) : []), [place?.kitchenId]);
  return (
    <section class="flow">
      <ScreenHeader title="Draft orders" back={{ href: paths.section, label: 'Section' }} />
      <Hint name="orders">From your latest counts, in whole packs. Mep never orders: send it yourself.</Hint>
      {orders?.length === 0 && (
        <div class="empty-state">
          <p>Nothing below par. Count your section to see what’s short.</p>
        </div>
      )}
      {orders?.map((order) => (
        <section key={order.supplier?.id ?? 'none'} class="card">
          <div class="card__body flow">
            <h2 class="section-label">{order.supplier?.name ?? 'No supplier set'}</h2>
            {order.supplier?.cutOff && <p class="plan-flag">Cut-off: {order.supplier.cutOff}</p>}
            <ul class="flow" role="list">
              {order.lines.map((l) => (
                <li key={l.ingredientName}>
                  <strong>{l.packs !== null && l.pack ? `${l.packs} × ${l.pack.amount}${l.pack.unit}` : `${l.short.amount}${l.short.unit}`}</strong> {l.brand ?? l.ingredientName}
                  {l.packs === null && <span class="list-row__meta"> (set its pack size on the ingredient)</span>}
                </li>
              ))}
            </ul>
            {order.total > 0 && <p>About {formatPence(order.total)}</p>}
            <button
              class="button"
              type="button"
              onClick={async () => {
                const result = await shareText(orderText(order, kitchen?.name ?? ''));
                if (result === 'copied') showMessage('Copied. Paste it into a message.');
              }}
            >
              <Icon name="share" /> Share the draft
            </button>
          </div>
        </section>
      ))}
    </section>
  );
}

// ─── Checklists (A6) ──────────────────────────────────────────────────────

/** Opening and closing checks: one tap per item, kept day by day. */
export function Checklists() {
  const { kitchenId, sectionId } = useSection();
  const [kind, setKind] = useState<ChecklistKind>(new Date().getHours() < 15 ? 'open' : 'close');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const list = useLiveQuery(async () => (sectionId ? findChecklist(sectionId, kind) : undefined), [sectionId, kind]);
  const run = useLiveQuery(async () => (list ? getRun(list.id, toCalendarDate(new Date())) : undefined), [list?.id]);
  const history = useLiveQuery(async () => (list ? checklistHistory(list.id) : []), [list?.id]);
  if (!kitchenId || !sectionId) return <ScreenHeader title="Checklists" back={{ href: paths.section, label: 'Section' }} />;
  const items = [...(list?.items ?? [])].sort((a, b) => a.order - b.order);
  const ticked = new Set(run?.ticked.map((t) => t.itemId));
  const yesterday = history?.find((h) => h.date !== toCalendarDate(new Date()));

  return (
    <section class="flow">
      <ScreenHeader title="Checklists" back={{ href: paths.section, label: 'Section' }} />
      <SectionChooser kitchenId={kitchenId} value={sectionId} />
      <Segmented
        label="Which"
        choices={[
          { value: 'open', label: 'Opening' },
          { value: 'close', label: 'Closing' },
        ]}
        value={kind}
        onChange={setKind}
      />
      {items.length > 0 && (
        <p class="menu-summary">
          {ticked.size} of {items.length} done today{yesterday ? ` · last time ${yesterday.ticked} on ${formatCalendarDate(yesterday.date)}` : ''}
        </p>
      )}
      <ul class="row-list" role="list">
        {items.map((item, i) => (
          <li key={item.id} class="list-row" data-static={editing}>
            {editing ? (
              <>
                <span class="list-row__main">
                  <span class="list-row__title">{item.text}</span>
                </span>
                <button class="button" type="button" data-variant="ghost" aria-label={`Move ${item.text} up`} disabled={i === 0} onClick={() => trackSave(moveChecklistItem(list!.id, item.id, -1))}>
                  ↑
                </button>
                <button
                  class="button"
                  type="button"
                  data-variant="ghost"
                  aria-label={`Remove ${item.text}`}
                  onClick={async () => {
                    const removed = await removeChecklistItem(list!.id, item.id);
                    if (removed) showMessage(`Removed “${removed.text}”.`, () => restoreChecklistItem(list!.id, removed));
                  }}
                >
                  <Icon name="bin" />
                </button>
              </>
            ) : (
              <button class="list-row__main checklist-item" type="button" aria-pressed={ticked.has(item.id)} onClick={() => trackSave(toggleTick(list!.id, item.id))}>
                <span class="plan-tick" aria-hidden="true">
                  {ticked.has(item.id) && <Icon name="tick" />}
                </span>
                <span class="list-row__title">{item.text}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {(editing || items.length === 0) && (
        <form
          class="input-group"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            await trackSave(addChecklistItem(sectionId, kind, text));
            setText('');
            // Keep the box open for the next check (it only shows while editing once there are items).
            setEditing(true);
          }}
        >
          <input class="input" aria-label="New check" placeholder="Fridge temps logged" autocomplete="off" value={text} onInput={(e) => setText(e.currentTarget.value)} />
          <button class="button" type="submit" disabled={!text.trim()}>
            Add
          </button>
        </form>
      )}
      {items.length > 0 && (
        <button class="button" type="button" data-variant="ghost" onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit the list'}
        </button>
      )}
      <Hint name="checklists">Official temperature records stay in the kitchen’s own system.</Hint>
    </section>
  );
}

// ─── Reports to print (A5, A8) ────────────────────────────────────────────

/** A menu's allergen matrix (A5): to print or save as PDF, or download as a spreadsheet. Marked as a working copy. */
export function AllergenMatrix({ id = '' }: { id?: string }) {
  const menu = useLiveQuery(() => getMenu(id), [id]);
  const rows = useLiveQuery(async () => (menu ? allergenMatrix(menu.id, menu.kitchenId) : []), [menu?.id]);
  const today = toCalendarDate(new Date());
  if (!menu || !rows) return <ScreenHeader title="" back={{ href: paths.menu(id), label: 'Menu' }} />;
  return (
    <section class="flow report">
      <ScreenHeader title={`${menu.name}: allergens`} back={{ href: paths.menu(id), label: menu.name }} />
      <p class="report__working">
        Working copy, {formatCalendarDate(today)}. From your own book: check it against the house matrix, supplier spec sheets and the head chef’s sign-off.
      </p>
      <div class="cluster" data-print="hide">
        <button class="button" type="button" data-variant="primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
        <button
          class="button"
          type="button"
          onClick={() => saveFile(new TextEncoder().encode(matrixCsv(rows, menu.name, today)), `${menu.name} allergens ${today}.csv`, 'text/csv')}
        >
          Spreadsheet (CSV)
        </button>
      </div>
      <div class="matrix-wrap">
        <table class="matrix">
          <thead>
            <tr>
              <th scope="col">Dish</th>
              {ALLERGENS.map((a) => (
                <th key={a.id} scope="col">
                  <span>{a.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dish} data-complete={r.complete}>
                <th scope="row">
                  {r.dish}
                  {!r.complete && ' (not all confirmed)'}
                </th>
                {ALLERGENS.map((a) => (
                  <td key={a.id} data-cell={r.cells[a.id]} title={r.detail[a.id]}>
                    {r.cells[a.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="field__hint">Y contains · May may contain · ? not all ingredients confirmed.</p>
    </section>
  );
}

/** The weekly section report (A8): one page, to print or save as PDF. */
export function WeeklyReportScreen() {
  const { query } = useLocation();
  const place = useLiveQuery(() => getPlace());
  const when = query.week ? new Date(`${query.week}T12:00:00`) : new Date();
  const report = useLiveQuery(async () => (place ? weeklyReport(place.kitchenId, when) : undefined), [place?.kitchenId, query.week]);
  if (!report) return <ScreenHeader title="Weekly report" back={{ href: paths.section, label: 'Section' }} />;
  const lastWeek = toCalendarDate(new Date(new Date(`${report.start}T12:00:00`).getTime() - 7 * 86_400_000));
  const nextWeek = toCalendarDate(new Date(new Date(`${report.start}T12:00:00`).getTime() + 7 * 86_400_000));
  const below = report.gp.filter((g) => g.belowTarget);
  return (
    <section class="flow report">
      <ScreenHeader title="Weekly report" back={{ href: paths.section, label: 'Section' }} />
      <p class="menu-summary">
        {report.kitchenName} · {formatCalendarDate(report.start)} to {formatCalendarDate(report.end)}
      </p>
      <div class="cluster" data-print="hide">
        <button class="button" type="button" data-variant="primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
        <a class="button" href={`${paths.report}?week=${lastWeek}`}>
          Week before
        </a>
        {report.end < toCalendarDate(new Date()) && (
          <a class="button" href={`${paths.report}?week=${nextWeek}`}>
            Week after
          </a>
        )}
      </div>

      <h2 class="section-label">Goal</h2>
      <p>{report.goal?.text || 'No goal set this week.'}</p>
      {report.goal?.reflection && <p>How it went: {report.goal.reflection}</p>}

      <h2 class="section-label">Stock</h2>
      {report.stock.length === 0 ? (
        <p>No counts.</p>
      ) : (
        <ul class="flow" role="list">
          {report.stock.map((s) => (
            <li key={s.section}>
              {s.section}: {formatPence(s.pence)} {s.date ? `(counted ${formatCalendarDate(s.date)})` : ''}
              {s.uncosted ? `, ${s.uncosted} items not costed` : ''}
            </li>
          ))}
        </ul>
      )}
      {report.oftenShort.length > 0 && <p>Often short: {report.oftenShort.map((o) => `${o.name} (${o.times} counts)`).join(', ')}.</p>}

      <h2 class="section-label">Waste</h2>
      <p>
        {report.waste.entries} {report.waste.entries === 1 ? 'entry' : 'entries'}, {formatPence(report.waste.pence)}
        {report.waste.uncosted ? ` (${report.waste.uncosted} not costed)` : ''}.
      </p>
      {report.waste.byReason.length > 0 && <p>By cause: {report.waste.byReason.map((r) => `${r.reason} ${formatPence(r.pence)}`).join(' · ')}</p>}
      {report.waste.topItems.length > 0 && <p>Most wasted: {report.waste.topItems.map((t) => `${t.name} ${formatPence(t.pence)}`).join(' · ')}</p>}

      <h2 class="section-label">GP</h2>
      {report.gp.length === 0 ? (
        <p>No dishes on current menus.</p>
      ) : (
        <table class="gp-table">
          <thead>
            <tr>
              <th scope="col">Dish</th>
              <th scope="col">Cost</th>
              <th scope="col">GP</th>
              <th scope="col">Target</th>
            </tr>
          </thead>
          <tbody>
            {report.gp.map((g) => (
              <tr key={g.menuDishId} data-below={g.belowTarget}>
                <th scope="row">{g.dishName}</th>
                <td>{formatPence(g.cost.perPortion)}{g.cost.missing.length ? '*' : ''}</td>
                <td>{g.gp !== null ? `${g.gp}%` : '–'}</td>
                <td>{g.target !== null ? `${g.target}%` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {below.length > 0 && <p class="plan-flag">Below target: {below.map((b) => b.dishName).join(', ')}</p>}
      <p class="field__hint">GP from prices without VAT. * not every ingredient priced. Working figures from your own book, not the kitchen’s records.</p>
    </section>
  );
}

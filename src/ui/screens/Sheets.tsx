import { useLocation } from 'preact-iso';
import { useRef, useState } from 'preact/hooks';
import { nextShiftDate } from '../../core/sheet/sheet';
import { toCalendarDate } from '../../core/time/calendar';
import { getKitchen, getPlace, listShifts } from '../../data/kitchens';
import {
  addSheetItems,
  findSheet,
  getOrCreateSheet,
  getSheet,
  getSheetView,
  listSheets,
  readTypedItem,
  setSheetCovers,
  setSheetPhoto,
  sheetText,
  writeNextSheetWithSummary,
} from '../../data/sheets';
import type { CalendarDate, Id, KitchenId } from '../../data/types';
import { AddToSheet } from '../components/AddToSheet';
import { MediaView } from '../components/MediaView';
import { DoneFooter, ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { SheetItems } from '../components/SheetView';
import { showMessage } from '../components/UndoBar';
import { formatCalendarDate } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { shrinkPhoto } from '../media';
import { paths } from '../router';
import { shareText } from '../saveFile';
import { trackSave } from '../saveStatus';

interface SheetPanelProps {
  kitchenId: KitchenId;
  /** An older sheet's sections; today's sheet is the kitchen's and has none (DECISIONS 48). */
  sectionIds?: Id[];
  date: CalendarDate;
  /** Today's sheet offers "write the next shift's sheet". */
  isToday?: boolean;
}

/**
 * A shift sheet (SH1–SH3): its heading, covers, chef's photo, items to tick,
 * and the ways to fill it. Used on Today and for any other day's sheet.
 */
export function SheetPanel({ kitchenId, sectionIds = [], date, isToday }: SheetPanelProps) {
  const key = sectionIds.join('|');
  const sheet = useLiveQuery(() => findSheet(kitchenId, date, sectionIds), [kitchenId, date, key]);
  const view = useLiveQuery(async () => (sheet ? getSheetView(sheet.id, kitchenId) : null), [sheet?.id, sheet?.updatedAt, kitchenId]);
  const kitchen = useLiveQuery(() => getKitchen(kitchenId), [kitchenId]);
  const shifts = useLiveQuery(() => listShifts(kitchenId), [kitchenId]);
  const [adding, setAdding] = useState(false);
  const [shareFallback, setShareFallback] = useState<string | null>(null);
  const { route } = useLocation();

  const ensureSheet = () => getOrCreateSheet(kitchenId, date, sectionIds);
  const heading = kitchen?.sheetName ?? "Today's sheet";

  async function share() {
    const id = await ensureSheet();
    const text = await sheetText(id, kitchenId, [kitchen?.name, formatCalendarDate(date)].filter(Boolean).join(' · '));
    const result = await shareText(text);
    if (result === 'copied') showMessage('Copied the sheet. Paste it into a message.');
    if (result === 'failed') setShareFallback(text);
  }

  async function writeNext() {
    const today = new Date(`${date}T12:00:00`);
    const shiftDays = [...new Set((shifts ?? []).flatMap((s) => s.days))];
    const nextDate = toCalendarDate(nextShiftDate(today, shiftDays));
    const fromId = await ensureSheet();
    const { id, carried, toppedUp } = await writeNextSheetWithSummary(fromId, nextDate);
    route(paths.sheet(id));
    const parts = [
      carried ? `${carried} unfinished ${carried === 1 ? 'item' : 'items'} carried over` : null,
      toppedUp ? `${toppedUp} below par at the count, to top up` : null,
    ].filter(Boolean);
    showMessage(`Started the sheet for ${formatCalendarDate(nextDate)}${parts.length ? `, with ${parts.join(' and ')}` : ''}.`);
  }


  return (
    <section class="flow" aria-label={heading}>
      <div class="sheet-head">
        <h2>{isToday ? heading : formatCalendarDate(date)}</h2>
        {sheet && <CoversField sheetId={sheet.id} covers={sheet.covers} />}
      </div>

      {sheet?.photoId && (
        <details class="sheet-photo">
          <summary>Chef’s sheet (photo)</summary>
          <MediaView id={sheet.photoId} />
        </details>
      )}

      {view && view.items.length > 0 ? (
        <SheetItems view={view} kitchenId={kitchenId} />
      ) : (
        <div class="empty-state flow">
          <p>{isToday ? 'Nothing on today’s sheet yet.' : 'Nothing on this sheet yet.'}</p>
          <p class="empty-state__hint">Add items, type in chef’s paper sheet, or pick from your section list.</p>
        </div>
      )}

      <div class="cluster">
        <button class="button" type="button" data-variant="primary" onClick={() => setAdding(true)}>
          + Add
        </button>
        <a class="button" href={paths.sheetPaper(date)}>
          <Icon name="camera" /> From chef’s sheet
        </a>
        {view && view.items.length > 0 && (
          <button class="button" type="button" onClick={share}>
            <Icon name="share" /> Share
          </button>
        )}
      </div>

      {/* Once there's something to carry over; tomorrow's sheet is also under ••• → Sheets. */}
      {isToday && view && view.items.length > 0 && (
        <button id="sheet-next" class="button" type="button" onClick={writeNext}>
          Write the next shift’s sheet
        </button>
      )}

      <Sheet open={shareFallback !== null} onClose={() => setShareFallback(null)} title="Copy the sheet">
        <p class="field__hint">Sharing isn’t available here. Select the text and copy it.</p>
        <textarea class="textarea" rows={10} readOnly value={shareFallback ?? ''} onFocus={(e) => e.currentTarget.select()} />
      </Sheet>
      <AddToSheet open={adding} onClose={() => setAdding(false)} kitchenId={kitchenId} ensureSheet={ensureSheet} />
    </section>
  );
}

function CoversField({ sheetId, covers }: { sheetId: Id; covers: number | null }) {
  const [text, setText] = useState(covers === null ? '' : String(covers));
  return (
    <label class="covers-field">
      <span>Covers</span>
      <input
        class="input"
        inputMode="numeric"
        value={text}
        placeholder="–"
        onInput={(e) => setText(e.currentTarget.value)}
        onBlur={() => {
          const n = parseInt(text, 10);
          void trackSave(setSheetCovers(sheetId, Number.isFinite(n) ? n : null));
        }}
      />
    </label>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────

/** Any day's sheet: /sheet/:id (tomorrow's, or yesterday's after midnight). */
export function SheetScreen({ id = '' }: { id?: string }) {
  const sheet = useLiveQuery(() => getSheet(id), [id]);
  if (!sheet) return <ScreenHeader title="" back={{ href: paths.today, label: 'Today' }} />;
  return (
    <section class="flow">
      <ScreenHeader title={formatCalendarDate(sheet.date)} back={{ href: paths.sheets, label: 'Sheets' }} />
      <SheetPanel kitchenId={sheet.kitchenId} sectionIds={sheet.sectionIds} date={sheet.date} />
    </section>
  );
}

/** Recent sheets for this kitchen. */
export function SheetsList() {
  const place = useLiveQuery(() => getPlace());
  const sheets = useLiveQuery(async () => (place ? listSheets(place.kitchenId) : []), [place?.kitchenId]);
  return (
    <section class="flow">
      <ScreenHeader title="Sheets" back={{ href: paths.today, label: 'Today' }} />
      {sheets?.length === 0 && (
        <div class="empty-state">
          <p>No sheets yet. Today’s sheet is on the Today tab.</p>
        </div>
      )}
      <ul class="row-list" role="list">
        {sheets?.map((sheet) => (
          <li key={sheet.id}>
            <a class="list-row" href={paths.sheet(sheet.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{formatCalendarDate(sheet.date)}</span>
                {sheet.date === toCalendarDate(new Date()) && <span class="list-row__meta">Today</span>}
              </span>
              <Icon name="chevron-right" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Entering chef's paper sheet (SH2): photograph it, then type each line while
 * the photo stays pinned at the top. Each line adds as you press return, and
 * the keyboard stays up for the next.
 */
export function PaperEntry() {
  const { query } = useLocation();
  const date = query.date ?? toCalendarDate(new Date());
  const place = useLiveQuery(() => getPlace());
  const sheet = useLiveQuery(async () => (place ? findSheet(place.kitchenId, date, []) : undefined), [place?.kitchenId, date]);
  const view = useLiveQuery(async () => (sheet && place ? getSheetView(sheet.id, place.kitchenId) : null), [sheet?.id, place?.kitchenId]);
  const [typed, setTyped] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);

  if (!place) return null;
  const kitchenId = place.kitchenId;
  const ensureSheet = () => getOrCreateSheet(kitchenId, date, []);

  async function onPhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await trackSave(setSheetPhoto(await ensureSheet(), await shrinkPhoto(file)));
  }

  async function add(event: Event) {
    event.preventDefault();
    const input = await readTypedItem(typed, kitchenId);
    if (!input) return;
    await trackSave(addSheetItems(await ensureSheet(), [input]));
    setTyped('');
  }

  const isToday = date === toCalendarDate(new Date());
  return (
    <section class="flow">
      <ScreenHeader title="From chef’s sheet" back={{ href: isToday ? paths.today : paths.sheets, label: isToday ? 'Today' : 'Sheets' }} />

      <div class="paper-pin">
        {sheet?.photoId ? (
          <MediaView id={sheet.photoId} />
        ) : (
          <button class="button" type="button" data-variant="primary" onClick={() => photoInput.current?.click()}>
            <Icon name="camera" /> Photograph chef’s sheet
          </button>
        )}
        <form class="input-group" onSubmit={add}>
          <input
            class="input"
            aria-label="Type a line from the sheet"
            value={typed}
            placeholder="beurre blanc 2l"
            autocomplete="off"
            enterkeyhint="next"
            onInput={(e) => setTyped(e.currentTarget.value)}
          />
          <button class="button" type="submit" disabled={!typed.trim()}>
            Add
          </button>
        </form>
      </div>
      <input ref={photoInput} class="visually-hidden" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" onChange={onPhoto} />

      <p class="field__hint">Type each line as it’s written. Mep finds your components and section list items; anything else is kept as typed.</p>
      {view && view.items.length > 0 && <SheetItems view={view} kitchenId={place.kitchenId} />}
      {sheet?.photoId && (
        <button class="button" type="button" onClick={() => photoInput.current?.click()}>
          Retake the photo
        </button>
      )}
      <DoneFooter href={isToday ? paths.today : sheet ? paths.sheet(sheet.id) : paths.sheets} />
    </section>
  );
}

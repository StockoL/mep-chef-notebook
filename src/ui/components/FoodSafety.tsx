/**
 * Food safety on screen (FS1, FS2, FS5):
 * - AllergenPicker: the 14, with sub-types for cereals and tree nuts;
 * - AllergenSummaryView: contains / may contain with where each comes from,
 *   and "not confirmed" lines, each one tap to fix ("which mayonnaise?");
 * - Products: the exact product this kitchen uses for a bought-in ingredient;
 * - MadeButton and BatchLabelView: "made" → a day-dot label.
 */

import { useRef, useState } from 'preact/hooks';
import { ALLERGENS, SUB_TYPES, allergenLabel, baseAllergen, type AllergenCode, type AllergenId } from '../../core/allergens/allergens';
import { parsePrice } from '../../core/money/money';
import { UNIT_CHOICES } from '../../core/units/units';
import type { Allergens, UnconfirmedLine } from '../../data/allergens';
import { menuGps } from '../../data/costing';
import { deleteBatch, getBatchLabel, makeBatch, setInitials } from '../../data/foodSafety';
import { getPlace } from '../../data/kitchens';
import { createProduct, deleteProduct, ensureSupplier, listProducts, listSuppliers, markChecked, setLineProduct, setProductLabelPhoto, updateProduct } from '../../data/products';
import { restoreSnapshot } from '../../data/snapshot';
import type { Id, KitchenId, Product } from '../../data/types';
import { formatCalendarDate } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { shrinkPhoto } from '../media';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { ChipChoice } from './Controls';
import { MediaView } from './MediaView';
import { Sheet } from './Sheet';
import { showMessage } from './UndoBar';

// ─── Picking allergens ────────────────────────────────────────────────────

const SUBS = SUB_TYPES as Partial<Record<AllergenId, readonly { id: string; label: string }[]>>;

/** The 14 as chips; picking cereals or tree nuts offers which ones (DECISIONS 52). */
export function AllergenPicker({ label, value, onChange }: { label: string; value: readonly AllergenCode[]; onChange: (codes: AllergenCode[]) => void }) {
  const has = (id: AllergenId) => value.some((c) => baseAllergen(c) === id);
  const toggleBase = (id: AllergenId) => onChange(has(id) ? value.filter((c) => baseAllergen(c) !== id) : [...value, id]);
  const toggleSub = (id: AllergenId, sub: string) => {
    const code = `${id}:${sub}` as AllergenCode;
    const rest = value.filter((c) => c !== code && c !== id);
    onChange(value.includes(code) ? (rest.some((c) => baseAllergen(c) === id) ? rest : [...rest, id]) : [...rest, code]);
  };
  return (
    <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <p class="label">{label}</p>
      <div class="cluster" role="group" aria-label={label} style={{ '--gutter': 'var(--space-2xs)' }}>
        {ALLERGENS.map((a) => (
          <button key={a.id} class="chip" type="button" aria-pressed={has(a.id)} onClick={() => toggleBase(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      {ALLERGENS.filter((a) => SUBS[a.id] && has(a.id)).map((a) => (
        <div key={a.id} class="flow" style={{ '--flow-space': 'var(--space-3xs)' }}>
          <p class="field__hint">{a.label}: which? (optional)</p>
          <div class="cluster" role="group" aria-label={`${a.label}: which`} style={{ '--gutter': 'var(--space-2xs)' }}>
            {SUBS[a.id]!.map((s) => (
              <button key={s.id} class="chip reading-chip" type="button" aria-pressed={value.includes(`${a.id}:${s.id}` as AllergenCode)} onClick={() => toggleSub(a.id, s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Milk, Tree nuts (hazelnut)" for a list of codes. */
export function allergenList(codes: readonly string[]): string {
  return codes.map(allergenLabel).join(', ');
}

// ─── The summary ──────────────────────────────────────────────────────────

/** Contains / may contain, where from, and what isn't confirmed (FS1, FS5). */
export function AllergenSummaryView({ allergens, kitchenId }: { allergens: Allergens; kitchenId: KitchenId }) {
  const [fixing, setFixing] = useState<UnconfirmedLine | null>(null);
  const { contains, mayContain, toConfirm, complete, empty, unrecorded } = allergens;
  // Why it isn't complete, in the chef's words: unconfirmed lines and parts with nothing recorded.
  const missing = [
    toConfirm.length ? `${toConfirm.length} ${toConfirm.length === 1 ? 'ingredient isn’t' : 'ingredients aren’t'} confirmed` : null,
    unrecorded.length ? `no ingredients recorded for ${unrecorded.join(', ')}` : null,
  ].filter(Boolean);
  return (
    <section class="flow allergens" aria-labelledby="allergens-title">
      <h2 id="allergens-title">Allergens</h2>
      <p class="allergens__status" data-state={empty ? 'unknown' : complete ? 'complete' : 'incomplete'}>
        {empty
          ? 'Allergens not known yet: no ingredients recorded.'
          : complete
            ? 'Every line confirmed.'
            : `Not complete: ${missing.join('; ')}. Never read this as allergen-free.`}
      </p>
      {contains.length === 0 && complete && <p>None in its ingredients as recorded.</p>}
      {contains.length > 0 && (
        <ul class="allergen-list" role="list">
          {contains.map((c) => (
            <li key={c.allergen}>
              <strong>
                {c.label}
                {c.subTypes.length ? ` (${c.subTypes.join(', ')})` : ''}
              </strong>
              <span class="list-row__meta"> from {c.from.join('; ')}</span>
            </li>
          ))}
        </ul>
      )}
      {mayContain.length > 0 && (
        <>
          <h3 class="used-in__label">May contain</h3>
          <ul class="allergen-list" role="list">
            {mayContain.map((m) => (
              <li key={m.allergen}>
                {m.label}
                {m.subTypes.length ? ` (${m.subTypes.join(', ')})` : ''}
                <span class="list-row__meta"> from {m.from.join('; ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {toConfirm.length > 0 && (
        <>
          <h3 class="used-in__label">Not confirmed</h3>
          <ul class="row-list" role="list">
            {toConfirm.map((line) => (
              <li key={line.lineId}>
                {line.productId ? (
                  // There's a product, but its label hasn't been checked: that's done on the ingredient.
                  <a class="list-row" href={paths.ingredient(line.ingredientId)}>
                    <span class="list-row__main">
                      <span class="list-row__title">{line.ingredientName}: check the label</span>
                      <span class="list-row__meta">in {line.componentName}</span>
                    </span>
                    <Icon name="chevron-right" />
                  </a>
                ) : (
                  <button class="list-row" type="button" onClick={() => setFixing(line)}>
                    <span class="list-row__main">
                      <span class="list-row__title">Which {line.ingredientName.toLowerCase()}?</span>
                      <span class="list-row__meta">in {line.componentName}</span>
                    </span>
                    <Icon name="chevron-right" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <Sheet open={fixing !== null} onClose={() => setFixing(null)} title={fixing ? `Which ${fixing.ingredientName.toLowerCase()}?` : ''}>
        {fixing && <ProductChooser line={fixing} kitchenId={kitchenId} onDone={() => setFixing(null)} />}
      </Sheet>
    </section>
  );
}

/** Choose this line's product, or add the one the kitchen uses. */
function ProductChooser({ line, kitchenId, onDone }: { line: UnconfirmedLine; kitchenId: KitchenId; onDone: () => void }) {
  const products = useLiveQuery(() => listProducts(line.ingredientId, kitchenId), [line.ingredientId, kitchenId]);
  const [brand, setBrand] = useState('');
  async function choose(productId: Id) {
    await trackSave(setLineProduct(line.lineId, productId));
    onDone();
  }
  return (
    <>
      <p class="field__hint">The exact product this kitchen uses. Its label’s allergens then count for {line.componentName}.</p>
      <ul class="row-list" role="list">
        {products?.map((p) => (
          <li key={p.id}>
            <button class="list-row" type="button" onClick={() => choose(p.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{p.brand}</span>
                <span class="list-row__meta">{p.contains.length ? `Contains ${allergenList(p.contains)}` : 'No allergens recorded'}</span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
      <form
        class="input-group"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!brand.trim()) return;
          const id = await trackSave(createProduct(line.ingredientId, kitchenId, brand));
          await choose(id);
          showMessage(`Added ${brand.trim()}. Add what its label says on the ingredient’s page.`, { view: { label: 'Open', href: paths.ingredient(line.ingredientId) } });
        }}
      >
        <input class="input" aria-label="New product" placeholder="New: brand or supplier’s name" autocomplete="off" value={brand} onInput={(e) => setBrand(e.currentTarget.value)} />
        <button class="button" type="submit" disabled={!brand.trim()}>
          Add
        </button>
      </form>
    </>
  );
}

// ─── Products (FS5) ───────────────────────────────────────────────────────

/** A bought-in ingredient's products in this kitchen. */
export function ProductsSection({ ingredientId, ingredientName }: { ingredientId: Id; ingredientName: string }) {
  const place = useLiveQuery(() => getPlace());
  const kitchenId = place?.kitchenId;
  const products = useLiveQuery(async () => (kitchenId ? listProducts(ingredientId, kitchenId) : []), [ingredientId, kitchenId]);
  const [brand, setBrand] = useState('');
  const [open, setOpen] = useState<Id | null>(null);
  const editing = products?.find((p) => p.id === open);
  if (!kitchenId) return null;
  return (
    <section class="flow" aria-labelledby="products-title">
      <h2 id="products-title">Products here</h2>
      <p class="field__hint">The exact {ingredientName.toLowerCase()} this kitchen buys: its allergens come from the label. With one product, recipes use it; with more, each recipe says which.</p>
      <ul class="row-list" role="list">
        {products?.map((p) => (
          <li key={p.id}>
            <button class="list-row" type="button" onClick={() => setOpen(p.id)}>
              <span class="list-row__main">
                <span class="list-row__title">{p.brand}</span>
                <span class="list-row__meta">
                  {[p.contains.length ? `Contains ${allergenList(p.contains)}` : p.checkedOn ? 'No allergens on the label' : null, p.mayContain.length ? `may contain ${allergenList(p.mayContain)}` : null, p.checkedOn ? `checked ${formatCalendarDate(p.checkedOn)}` : 'Label not checked: not confirmed']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Icon name="chevron-right" />
            </button>
          </li>
        ))}
      </ul>
      <form
        class="input-group"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!brand.trim()) return;
          const id = await trackSave(createProduct(ingredientId, kitchenId, brand));
          setBrand('');
          setOpen(id);
        }}
      >
        <input class="input" aria-label="New product" placeholder="Hellmann’s, Brakes own…" autocomplete="off" value={brand} onInput={(e) => setBrand(e.currentTarget.value)} />
        <button class="button" type="submit" disabled={!brand.trim()}>
          Add
        </button>
      </form>
      <Sheet open={!!editing} onClose={() => setOpen(null)} title={editing?.brand ?? ''}>
        {editing && <ProductEditor key={editing.id} product={editing} onDone={() => setOpen(null)} />}
      </Sheet>
    </section>
  );
}

function ProductEditor({ product, onDone }: { product: Product; onDone: () => void }) {
  const suppliers = useLiveQuery(() => listSuppliers(product.kitchenId), [product.kitchenId]);
  const [brand, setBrand] = useState(product.brand);
  const [newSupplier, setNewSupplier] = useState('');
  const [packAmount, setPackAmount] = useState(product.pack ? String(product.pack.amount) : '');
  const [packUnit, setPackUnit] = useState(product.pack?.unit ?? 'kg');
  const [price, setPrice] = useState(product.price !== null ? (product.price / 100).toFixed(2) : '');
  const photo = useRef<HTMLInputElement>(null);

  // A change to what it contains re-checks every recipe using it (FS5): say which.
  async function saveAllergens(changes: Pick<Product, 'contains'> | Pick<Product, 'mayContain'>) {
    const affected = await trackSave(updateProduct(product.id, changes));
    const names = [...affected.components, ...affected.dishes];
    if (names.length) showMessage(`Re-checked: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` and ${names.length - 4} more` : ''}.`);
  }

  // A price change moves every dish's GP at once (A1): say if one drops below its target.
  async function savePrice() {
    const pence = parsePrice(price);
    if (pence === product.price) return;
    await trackSave(updateProduct(product.id, { price: pence, priceDate: pence !== null ? new Date().toISOString().slice(0, 10) : null }));
    const below = (await menuGps(product.kitchenId)).filter((g) => g.belowTarget);
    if (below.length) showMessage(`Below GP target now: ${below.map((g) => `${g.dishName} ${g.gp}%`).slice(0, 3).join(', ')}.`);
  }

  const savePack = (amount: string, unit: string) => {
    const n = Number(amount.replace(',', '.'));
    return trackSave(updateProduct(product.id, { pack: amount.trim() && Number.isFinite(n) ? { amount: n, unit } : null }));
  };

  return (
    <>
      <div class="field">
        <label class="label" for="product-brand">
          Brand or name
        </label>
        <input class="input" id="product-brand" autocomplete="off" value={brand} onInput={(e) => setBrand(e.currentTarget.value)} onBlur={() => brand.trim() && brand !== product.brand && trackSave(updateProduct(product.id, { brand: brand.trim() }))} />
      </div>
      <AllergenPicker label="Contains (from the label)" value={product.contains} onChange={(contains) => saveAllergens({ contains })} />
      <AllergenPicker label="May contain" value={product.mayContain} onChange={(mayContain) => saveAllergens({ mayContain })} />

      <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
        <p class="label">Label</p>
        {product.labelPhotoId && <MediaView id={product.labelPhotoId} />}
        <div class="cluster">
          <button class="button" type="button" onClick={() => photo.current?.click()}>
            <Icon name="camera" /> {product.labelPhotoId ? 'Retake the label' : 'Photograph the label'}
          </button>
          <button class="button" type="button" onClick={() => trackSave(markChecked(product.id))}>
            Checked today
          </button>
        </div>
        <p class="field__hint">
          {product.checkedOn
            ? `Label checked ${formatCalendarDate(product.checkedOn)}.`
            : 'Not checked against the label yet: recipes using it show “not confirmed”. Enter its allergens, or tap “Checked today” if the label has none.'}
        </p>
        <input
          ref={photo}
          class="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            input.value = '';
            if (file) await trackSave(setProductLabelPhoto(product.id, await shrinkPhoto(file)));
          }}
        />
      </div>

      <ChipChoice
        label="Supplier"
        choices={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
        value={product.supplierId}
        allowNone
        onChange={(supplierId) => trackSave(updateProduct(product.id, { supplierId }))}
      />
      <form
        class="input-group"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newSupplier.trim()) return;
          const supplierId = await trackSave(ensureSupplier(product.kitchenId, newSupplier));
          await trackSave(updateProduct(product.id, { supplierId }));
          setNewSupplier('');
        }}
      >
        <input class="input" aria-label="New supplier" placeholder="New supplier" autocomplete="off" value={newSupplier} onInput={(e) => setNewSupplier(e.currentTarget.value)} />
        <button class="button" type="submit" disabled={!newSupplier.trim()}>
          Add
        </button>
      </form>

      <div class="cluster">
        <div class="field">
          <label class="label" for="pack-amount">
            Pack
          </label>
          <input class="input" id="pack-amount" inputMode="decimal" autocomplete="off" value={packAmount} onInput={(e) => setPackAmount(e.currentTarget.value)} onBlur={() => savePack(packAmount, packUnit)} />
        </div>
        <div class="field">
          <label class="label" for="pack-price">
            Price (£)
          </label>
          <input class="input" id="pack-price" inputMode="decimal" autocomplete="off" value={price} onInput={(e) => setPrice(e.currentTarget.value)} onBlur={() => savePrice()} />
        </div>
      </div>
      <ChipChoice
        label="Pack unit"
        choices={UNIT_CHOICES.map((u) => ({ value: u, label: u === 'portion' ? 'portions' : u }))}
        value={packUnit}
        onChange={(u) => {
          if (!u) return;
          setPackUnit(u);
          if (packAmount.trim()) void savePack(packAmount, u);
        }}
      />

      <button
        class="button"
        type="button"
        data-variant="danger"
        onClick={async () => {
          const snapshot = await deleteProduct(product.id);
          onDone();
          showMessage(`Deleted ${product.brand}.`, () => restoreSnapshot(snapshot));
        }}
      >
        Delete product
      </button>
    </>
  );
}

// ─── Made, and the label (FS2) ────────────────────────────────────────────

/** "Made": records a batch and shows its label. */
export function MadeButton({ componentId, label = 'Made: label it' }: { componentId: Id; label?: string }) {
  const [batchId, setBatchId] = useState<Id | null>(null);
  return (
    <>
      <button
        class="button"
        type="button"
        onClick={async () => {
          const place = await getPlace();
          setBatchId(await trackSave(makeBatch(componentId, place.kitchenId)));
        }}
      >
        {label}
      </button>
      <Sheet open={batchId !== null} onClose={() => setBatchId(null)} title="Label">
        {batchId && <BatchLabelView batchId={batchId} onDeleted={() => setBatchId(null)} />}
      </Sheet>
    </>
  );
}

const longDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** A day-dot label to copy onto the real one: item, made, use-by (its day large), initials, allergens. */
export function BatchLabelView({ batchId, onDeleted }: { batchId: Id; onDeleted?: () => void }) {
  const label = useLiveQuery(() => getBatchLabel(batchId), [batchId]);
  const [initials, setInitialsText] = useState<string | null>(null);
  if (!label) return null;
  const { batch, name, shelfLife, allergens } = label;
  const useByDay = batch.useBy ? new Date(batch.useBy).toLocaleDateString('en-GB', { weekday: 'long' }) : null;
  return (
    <>
      <article class="day-dot" aria-label={`Label for ${name}`}>
        <p class="day-dot__name">{name}</p>
        <p>Made {longDate(batch.madeAt)}</p>
        {batch.useBy ? (
          <>
            <p class="day-dot__day">Use by {useByDay}</p>
            <p>{longDate(batch.useBy)}</p>
          </>
        ) : (
          <p class="plan-flag">No shelf life set for this in this kitchen: no use-by worked out.</p>
        )}
        <p>
          {allergens.empty
            ? 'Allergens not known: no ingredients recorded.'
            : allergens.contains.length
              ? `Contains: ${allergens.contains.map((c) => (c.subTypes.length ? `${c.label} (${c.subTypes.join(', ')})` : c.label)).join(', ')}`
              : 'No allergens recorded.'}
          {!allergens.empty && !allergens.complete && ' Not all ingredients confirmed.'}
        </p>
        <p class="day-dot__initials">{label.initials || '—'}</p>
      </article>
      {shelfLife && <p class="field__hint">Use-by from the kitchen’s rule: {shelfLife.text} ({shelfLife.from === 'component' ? 'for this' : 'for its type'}).</p>}
      {!shelfLife && (
        <a class="button" href={paths.kitchenPart(batch.kitchenId, 'house-rules')}>
          Set shelf lives in house rules
        </a>
      )}
      <div class="field">
        <label class="label" for="label-initials">
          Your initials
        </label>
        <input
          class="input"
          id="label-initials"
          autocomplete="off"
          maxLength={4}
          value={initials ?? label.initials}
          onInput={(e) => setInitialsText(e.currentTarget.value)}
          onBlur={() => initials !== null && trackSave(setInitials(initials))}
        />
      </div>
      <button
        class="button"
        type="button"
        data-variant="ghost"
        onClick={async () => {
          const removed = await deleteBatch(batchId);
          onDeleted?.();
          if (removed) showMessage('Batch deleted.', () => restoreSnapshot({ batches: [removed] }));
        }}
      >
        Not made after all
      </button>
    </>
  );
}

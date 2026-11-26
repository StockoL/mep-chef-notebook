/**
 * Scaling on screen (S1–S3, UX → Component: "scale control at the top").
 *
 * - ScaleControl and IngredientRows, on a component's reading view: one
 *   line saying the scale, and the ingredients at that scale. The choice is
 *   remembered per component (UX rule 2) and never changes the recipe.
 * - PortionsPanel, on a dish: "For 40 covers or people" → each component's
 *   amount, with a link to the component scaled to it.
 */

import { useState } from 'preact/hooks';
import { formatAmount } from '../../core/scaling/rounding';
import { UNIT_CHOICES } from '../../core/units/units';
import { updateIngredient } from '../../data/library';
import {
  getDishNeeds,
  ingredientCountUnits,
  getDishPortions,
  getScaledComponent,
  setDishPortions,
  setQuantityPerPortion,
  setScaleChoice,
  type ScaleChoice,
  type ScaledLine,
} from '../../data/scaling';
import type { DishComponent, Id, Ingredient, KitchenId, Quantity } from '../../data/types';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';
import { ChipChoice } from './Controls';
import { Sheet } from './Sheet';
import { Hint } from './Hint';

/** Units offered when typing an amount: the usual ones, plus the line's own. */
function unitChoices(extra: (string | null | undefined)[] = []) {
  const units: string[] = [...UNIT_CHOICES];
  for (const unit of extra) if (unit && !units.includes(unit)) units.push(unit);
  return units.map((u) => ({ value: u, label: u === 'portion' ? 'portions' : u }));
}

const readNumber = (text: string) => {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

// ─── Component ────────────────────────────────────────────────────────────

/**
 * The scale control on a recipe's reading view (FEEL_PASS 2): one line,
 * "Makes 1kg · as written" or "Makes 2kg · ×2". Tap it for the scaling sheet:
 * an amount to make, from what you've got, or back to as written.
 */
export function ScaleControl({ componentId, kitchenId, choice, variationId }: { componentId: Id; kitchenId: KitchenId; choice: ScaleChoice | null; variationId?: Id | null }) {
  const scaled = useLiveQuery(() => getScaledComponent(componentId, kitchenId, choice, undefined, variationId), [componentId, kitchenId, JSON.stringify(choice), variationId]);
  const [sheet, setSheet] = useState<'menu' | 'yield' | 'anchor' | null>(null);
  // A sheet's close event arrives after the next one has opened: only clear it if it's still the one showing.
  const closeSheet = (which: 'menu' | 'yield' | 'anchor') => () => setSheet((current) => (current === which ? null : current));
  if (!scaled) return null;

  const choose = async (next: ScaleChoice | null) => {
    await trackSave(setScaleChoice(componentId, next));
    setSheet(null);
  };
  const isScaled = choice !== null && !scaled.problem;
  const factor = Math.round(scaled.factor * 100) / 100;
  const anchorLine = choice?.by === 'anchor' ? scaled.lines.find((l) => l.lineId === choice.lineId) : undefined;

  return (
    <>
      <button class="scale-control" type="button" onClick={() => setSheet('menu')} data-scaled={isScaled}>
        <span class="scale-control__amount">{scaled.makes ? `Makes ${scaled.makes}` : 'Scale'}</span>
        <span class="scale-control__factor">
          {isScaled ? `×${factor}${anchorLine && choice?.by === 'anchor' ? ` from ${formatAmount(choice.amount, choice.unit)} ${anchorLine.name.toLowerCase()}` : ''}` : 'as written'}
        </span>
      </button>
      {scaled.problem && <p class="plan-flag">{scaled.problem}</p>}

      <Sheet open={sheet === 'menu'} onClose={closeSheet('menu')} title="Scale">
        {sheet === 'menu' && (
          <ul class="row-list" role="list">
            <li>
              <button class="list-row" type="button" onClick={() => setSheet('yield')}>
                <span class="list-row__main">
                  <span class="list-row__title">Make an amount</span>
                  <span class="list-row__meta">{scaled.baseYield ? `As written it makes ${formatAmount(scaled.baseYield.amount, scaled.baseYield.unit)}` : 'Set what it makes first (Edit)'}</span>
                </span>
                <Icon name="chevron-right" />
              </button>
            </li>
            <li>
              <button class="list-row" type="button" onClick={() => setSheet('anchor')}>
                <span class="list-row__main">
                  <span class="list-row__title">From what I’ve got</span>
                  <span class="list-row__meta">Scale to one ingredient you have</span>
                </span>
                <Icon name="chevron-right" />
              </button>
            </li>
            {choice && (
              <li>
                <button class="list-row" type="button" onClick={() => choose(null)}>
                  <span class="list-row__main">
                    <span class="list-row__title">As written</span>
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </Sheet>
      <Sheet open={sheet === 'yield'} onClose={closeSheet('yield')} title="Make…">
        {sheet === 'yield' && <YieldForm base={scaled.baseYield} current={choice?.by === 'yield' ? choice : null} onScale={choose} />}
      </Sheet>
      <Sheet open={sheet === 'anchor'} onClose={closeSheet('anchor')} title="From what I’ve got">
        {sheet === 'anchor' && <AnchorForm lines={scaled.lines} current={choice?.by === 'anchor' ? choice : null} onScale={choose} />}
      </Sheet>
    </>
  );
}

/**
 * The ingredients to cook from: name left, amount right (at the chosen
 * scale), prep note muted. A component opens scaled to the amount needed;
 * an ingredient opens its page.
 */
export function IngredientRows({ componentId, kitchenId, choice, variationId }: { componentId: Id; kitchenId: KitchenId; choice: ScaleChoice | null; variationId?: Id | null }) {
  const scaled = useLiveQuery(() => getScaledComponent(componentId, kitchenId, choice, undefined, variationId), [componentId, kitchenId, JSON.stringify(choice), variationId]);
  if (!scaled || scaled.lines.length === 0) return null;
  const isScaled = choice !== null && !scaled.problem;
  return (
    <ul class="ingredient-rows" role="list" aria-label="Ingredients">
      {scaled.lines.map((line) => {
        const amount = isScaled ? line.scaled : line.written;
        const content = (
          <>
            <span class="ingredient-rows__name">
              {line.name}
              {line.prepNote && <span class="ingredient-rows__note">, {line.prepNote}</span>}
            </span>
            <span class="ingredient-rows__amount">
              {amount || (line.canAnchor ? '' : 'to taste')}
              {line.estimate && <span class="ingredient-rows__note"> ≈ {line.estimate}</span>}
            </span>
          </>
        );
        const href = line.component ? paths.componentMaking(line.component.id, line.component.amount, line.component.unit) : line.ingredientId ? paths.ingredient(line.ingredientId) : null;
        return (
          <li key={line.lineId}>
            {href ? (
              <a class="ingredient-rows__row" href={href}>
                {content}
              </a>
            ) : (
              <span class="ingredient-rows__row">{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function YieldForm({ base, current, onScale }: { base: Quantity | null; current: { amount: number; unit: string } | null; onScale: (choice: ScaleChoice) => void }) {
  const [amount, setAmount] = useState(current ? String(current.amount) : '');
  const [unit, setUnit] = useState(current?.unit ?? base?.unit ?? 'l');
  const value = readNumber(amount);
  if (!base) {
    return <p>Set what this recipe makes first: “Makes” on the recipe. Then it can be scaled to any amount.</p>;
  }
  return (
    <form
      class="flow"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onScale({ by: 'yield', amount: value, unit });
      }}
    >
      <p class="field__hint">As written, it makes {formatAmount(base.amount, base.unit)}.</p>
      <div class="field">
        <label class="label" for="make-amount">
          How much?
        </label>
        <input class="input" id="make-amount" inputMode="decimal" enterkeyhint="go" autocomplete="off" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
      </div>
      <ChipChoice label="Unit" choices={unitChoices([base.unit])} value={unit} onChange={(u) => u && setUnit(u)} />
      <button class="button" type="submit" data-variant="primary" disabled={!value}>
        Scale
      </button>
    </form>
  );
}

function AnchorForm({ lines, current, onScale }: { lines: ScaledLine[]; current: { lineId: Id; amount: number; unit: string } | null; onScale: (choice: ScaleChoice) => void }) {
  const anchorable = lines.filter((l) => l.canAnchor);
  const [lineId, setLineId] = useState<Id | null>(current?.lineId ?? null);
  const line = anchorable.find((l) => l.lineId === lineId);
  const [amount, setAmount] = useState(current ? String(current.amount) : '');
  const [unit, setUnit] = useState(current?.unit ?? line?.unit ?? 'g');
  const value = readNumber(amount);

  if (anchorable.length === 0) return <p>None of the ingredients has an amount yet, so there’s nothing to scale from.</p>;
  if (!line) {
    return (
      <>
        <p class="field__hint">Which ingredient do you have a set amount of?</p>
        <ul class="row-list" role="list">
          {anchorable.map((l) => (
            <li key={l.lineId}>
              <button
                class="list-row"
                type="button"
                onClick={() => {
                  setLineId(l.lineId);
                  setUnit(l.unit ?? 'g');
                }}
              >
                <span class="list-row__main">
                  <span class="list-row__title">{l.name}</span>
                  <span class="list-row__meta">recipe says {l.written}</span>
                </span>
                <Icon name="chevron-right" />
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <form
      class="flow"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onScale({ by: 'anchor', lineId: line.lineId, ingredientId: line.ingredientId, amount: value, unit });
      }}
    >
      <p class="field__hint">
        The recipe says {line.written} {line.name.toLowerCase()}.
      </p>
      <div class="field">
        <label class="label" for="anchor-amount">
          How much {line.name.toLowerCase()} have you got?
        </label>
        <input class="input" id="anchor-amount" inputMode="decimal" enterkeyhint="go" autocomplete="off" autofocus value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
      </div>
      <ChipChoice label="Unit" choices={unitChoices([line.unit])} value={unit} onChange={(u) => u && setUnit(u)} />
      <div class="cluster">
        <button class="button" type="submit" data-variant="primary" disabled={!value}>
          Scale
        </button>
        <button class="button" type="button" data-variant="ghost" onClick={() => setLineId(null)}>
          Another ingredient
        </button>
      </div>
    </form>
  );
}

// ─── Dish ─────────────────────────────────────────────────────────────────

/** "For 40 covers or people": each component's amount for that many (S1, S3). */
export function PortionsPanel({ dishId, kitchenId }: { dishId: Id; kitchenId: KitchenId }) {
  const saved = useLiveQuery(() => getDishPortions(dishId), [dishId]);
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? (saved ? String(saved) : '');
  const portions = readNumber(text);
  const needs = useLiveQuery(async () => (portions ? getDishNeeds(dishId, kitchenId, portions) : []), [dishId, kitchenId, portions]);

  return (
    <section class="flow" aria-labelledby="portions-title">
      <h2 class="section-label" id="portions-title">How many?</h2>
      <div class="field">
        <label class="label" for="dish-portions">
          Covers or people
        </label>
        <input
          class="input"
          id="dish-portions"
          inputMode="numeric"
          autocomplete="off"
          placeholder="40"
          value={text}
          onInput={(e) => setTyped(e.currentTarget.value)}
          onBlur={() => trackSave(setDishPortions(dishId, portions ? Math.round(portions) : null))}
        />
      </div>
      {portions && needs && needs.length > 0 && (
        <ul class="row-list" role="list" aria-label={`For ${portions}`}>
          {needs.map((need) => (
            <li key={need.link.id}>
              <a
                class="list-row"
                href={need.amount !== null && need.unit ? paths.componentMaking(need.component.id, need.amount, need.unit) : paths.component(need.component.id)}
              >
                <span class="list-row__main">
                  <span class="list-row__title">{need.component.name}</span>
                  <span class="list-row__meta">
                    {[need.needed ? `${need.needed} for ${portions}` : 'No amount per portion yet', need.isDraft ? 'Draft' : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Icon name="chevron-right" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "30ml a portion": how much of a component goes on one plate. */
export function PerPortionButton({ link, name }: { link: DishComponent; name: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(link.quantityPerPortion ? String(link.quantityPerPortion.amount) : '');
  const [unit, setUnit] = useState(link.quantityPerPortion?.unit ?? 'g');
  const value = readNumber(amount);
  const save = (nextAmount: number | null, nextUnit: string) => trackSave(setQuantityPerPortion(link.id, nextAmount ? { amount: nextAmount, unit: nextUnit } : null));

  return (
    <>
      <button class="chip reading-chip" type="button" data-empty={!link.quantityPerPortion} onClick={() => setOpen(true)} aria-label={`Amount of ${name} per portion`}>
        {link.quantityPerPortion ? `${formatAmount(link.quantityPerPortion.amount, link.quantityPerPortion.unit)} a portion` : '+ a portion'}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`${name}: one portion`}>
        <div class="field">
          <label class="label" for={`portion-${link.id}`}>
            How much on one plate?
          </label>
          <input
            class="input"
            id={`portion-${link.id}`}
            inputMode="decimal"
            autocomplete="off"
            value={amount}
            onInput={(e) => setAmount(e.currentTarget.value)}
            onBlur={() => save(value, unit)}
          />
        </div>
        <ChipChoice
          label="Unit"
          choices={unitChoices([link.quantityPerPortion?.unit])}
          value={unit}
          onChange={(u) => {
            if (!u) return;
            setUnit(u);
            if (value) void save(value, u);
          }}
        />
        <button
          class="button"
          type="button"
          data-variant="primary"
          onClick={async () => {
            await save(value, unit);
            setOpen(false);
          }}
        >
          Done
        </button>
      </Sheet>
    </>
  );
}

// ─── Ingredient ───────────────────────────────────────────────────────────

/**
 * What this ingredient weighs (DECISIONS 41): grams in a millilitre, for
 * scaling between ml and g, and the chef's own weights for the counts it's
 * written with ("1 handful = 40 g", "1 egg = 55 g").
 */
export function IngredientWeights({ ingredient }: { ingredient: Ingredient }) {
  const used = useLiveQuery(() => ingredientCountUnits(ingredient.id), [ingredient.id]);
  const units = [...new Set([...(used ?? []), ...Object.keys(ingredient.unitWeights)])].sort();

  const saveWeight = (unit: string, grams: number | null) => {
    const unitWeights = { ...ingredient.unitWeights };
    if (grams) unitWeights[unit] = grams;
    else delete unitWeights[unit];
    return trackSave(updateIngredient(ingredient.id, { unitWeights }));
  };

  return (
    <section class="flow" aria-labelledby="weights-title">
      <h2 class="section-label" id="weights-title">Weights</h2>
      <Hint name="weights">For scaling between measures. Leave blank if you don’t know.</Hint>
      <NumberField
        id="yield-loss"
        label="Lost to peeling and trimming (%)"
        value={ingredient.yieldLossPercent}
        placeholder="0"
        onSave={(yieldLossPercent) => trackSave(updateIngredient(ingredient.id, { yieldLossPercent }))}
      />
      <NumberField
        id="density"
        label="1 ml weighs (g)"
        value={ingredient.density}
        placeholder="1"
        onSave={(density) => trackSave(updateIngredient(ingredient.id, { density }))}
      />
      {units.map((unit) => (
        <NumberField
          key={unit}
          id={`weight-${unit}`}
          label={unit === 'each' ? `One ${ingredient.name.toLowerCase()} weighs (g)` : `1 ${unit} weighs (g)`}
          value={ingredient.unitWeights[unit] ?? null}
          onSave={(grams) => saveWeight(unit, grams)}
        />
      ))}
    </section>
  );
}

function NumberField(props: { id: string; label: string; value: number | null; placeholder?: string; onSave: (value: number | null) => Promise<unknown> }) {
  const [text, setText] = useState(props.value === null ? '' : String(props.value));
  return (
    <div class="field">
      <label class="label" for={props.id}>
        {props.label}
      </label>
      <input
        class="input"
        id={props.id}
        inputMode="decimal"
        autocomplete="off"
        placeholder={props.placeholder}
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
        onBlur={() => {
          const value = readNumber(text);
          if (value !== props.value) void props.onSave(value);
        }}
      />
    </div>
  );
}

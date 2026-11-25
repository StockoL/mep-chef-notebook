/**
 * Scaling on screen (S1–S3, UX → Component: "scale control at the top").
 *
 * - ScalePanel, on a component: "Make…" (by yield) or "From what I've got"
 *   (anchor ingredient). While scaled, a banner says so and the ingredients
 *   show at the new amounts; "As written" goes back. The choice is
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

export function ScalePanel({ componentId, kitchenId, choice }: { componentId: Id; kitchenId: KitchenId; choice: ScaleChoice | null }) {
  const scaled = useLiveQuery(() => getScaledComponent(componentId, kitchenId, choice), [componentId, kitchenId, JSON.stringify(choice)]);
  const [sheet, setSheet] = useState<'yield' | 'anchor' | null>(null);
  if (!scaled) return null;

  const choose = async (next: ScaleChoice | null) => {
    await trackSave(setScaleChoice(componentId, next));
    setSheet(null);
  };
  const anchorLine = choice?.by === 'anchor' ? scaled.lines.find((l) => l.lineId === choice.lineId) : undefined;
  const isScaled = choice !== null && !scaled.problem;

  return (
    <section class="flow" aria-label="Scale">
      {choice ? (
        <div class="scale-banner" data-problem={Boolean(scaled.problem)} role="status">
          <p>
            {scaled.problem ??
              [
                `Scaled ×${Math.round(scaled.factor * 100) / 100}`,
                choice.by === 'anchor' && anchorLine ? `from ${formatAmount(choice.amount, choice.unit)} ${anchorLine.name.toLowerCase()}` : null,
                scaled.makes ? `makes ${scaled.makes}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
          </p>
          <div class="cluster">
            <button class="button" type="button" onClick={() => setSheet(choice.by)}>
              Change
            </button>
            <button class="button" type="button" data-variant="primary" onClick={() => choose(null)}>
              As written
            </button>
          </div>
        </div>
      ) : (
        <div class="cluster">
          <button class="button" type="button" onClick={() => setSheet('yield')}>
            Make…
          </button>
          <button class="button" type="button" onClick={() => setSheet('anchor')}>
            From what I’ve got
          </button>
        </div>
      )}

      {isScaled && (
        <section class="flow" aria-labelledby="scaled-title">
          <h2 id="scaled-title">Ingredients, scaled</h2>
          <ScaledLines lines={scaled.lines} />
          <p class="field__hint">Scaling doesn’t change the recipe. To edit it, go back to as written.</p>
        </section>
      )}

      <Sheet open={sheet === 'yield'} onClose={() => setSheet(null)} title="Make…">
        {sheet === 'yield' && <YieldForm base={scaled.baseYield} current={choice?.by === 'yield' ? choice : null} onScale={choose} />}
      </Sheet>
      <Sheet open={sheet === 'anchor'} onClose={() => setSheet(null)} title="From what I’ve got">
        {sheet === 'anchor' && <AnchorForm lines={scaled.lines} current={choice?.by === 'anchor' ? choice : null} onScale={choose} />}
      </Sheet>
    </section>
  );
}

function ScaledLines({ lines }: { lines: ScaledLine[] }) {
  return (
    <ul class="line-rows" role="list" aria-label="Ingredients at this scale">
      {lines.map((line) => {
        const content = (
          <>
            <span class="line-rows__quantity">{line.scaled ?? ''}</span>
            <span class="line-rows__name">
              {line.name}
              {line.prepNote && <span class="line-rows__note">, {line.prepNote}</span>}
              {line.estimate && <span class="line-rows__estimate"> ≈ {line.estimate}</span>}
            </span>
            {line.written && <span class="line-rows__was">was {line.written}</span>}
          </>
        );
        return (
          <li key={line.lineId}>
            {line.component ? (
              <a class="line-rows__row" href={paths.componentMaking(line.component.id, line.component.amount, line.component.unit)}>
                {content}
              </a>
            ) : (
              <span class="line-rows__row">{content}</span>
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
      <h2 id="portions-title">How many?</h2>
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
      <h2 id="weights-title">Weights</h2>
      <p class="field__hint">For scaling between measures, and turning a handful or a knob into grams. Leave blank if you don’t know.</p>
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

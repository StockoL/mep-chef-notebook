/**
 * Section → Money (DECISIONS 54): every cost, price and GP figure in one
 * place. Recipe, dish and menu pages don't show money; this does.
 *
 * Top to bottom, in the order a chef acts on it:
 * 1. GP on each menu on now, below-target dishes flagged (tap → the menu, where prices are set);
 * 2. prices still to add (tap → the ingredient, where its product is priced);
 * 3. what each recipe on the menus costs;
 * 4. this week's stock value and waste.
 */

import { formatPence } from '../../core/costing/costing';
import { formatAmount } from '../../core/scaling/rounding';
import type { ComponentCost } from '../../data/costing';
import { getPlace } from '../../data/kitchens';
import { getMoneyView } from '../../data/money';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatCalendarDate } from '../format';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';

const BACK = { href: paths.section, label: 'Section' };

/** "£1.00 a batch · £0.20 per 100ml (makes 500ml)". */
function costSummary(cost: ComponentCost): string {
  const parts = [`${formatPence(cost.batch)} a batch`];
  if (cost.yield && cost.perUnit !== null) {
    const small = cost.yield.unit === 'ml' || cost.yield.unit === 'g';
    parts.push(`${formatPence(cost.perUnit * (small ? 100 : 1))} per ${small ? `100${cost.yield.unit}` : cost.yield.unit} (makes ${formatAmount(cost.yield.amount, cost.yield.unit)})`);
  }
  return parts.join(' · ');
}

export function Money() {
  const place = useLiveQuery(() => getPlace());
  const view = useLiveQuery(async () => (place ? getMoneyView(place.kitchenId) : undefined), [place?.kitchenId]);
  if (!view) return <ScreenHeader title="Money" back={BACK} />;
  const below = view.menus.flatMap((m) => m.dishes.filter((d) => d.belowTarget));

  return (
    <section class="flow">
      <ScreenHeader title="Money" back={BACK} />
      <p class="field__hint">Your working figures, from the prices in your book. GP from menu prices without VAT. Not the kitchen’s records.</p>

      <section class="flow" aria-labelledby="money-gp">
        <h2 id="money-gp">GP</h2>
        {view.menus.length === 0 && <p class="field__hint">No dishes on a menu on now. Put dishes on a menu, with prices, to see GP.</p>}
        {below.length > 0 && <p class="plan-flag">Below target: {below.map((b) => b.dishName).join(', ')}</p>}
        {view.menus.map(({ menu, dishes }) => (
          <div key={menu.id} class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
            <h3 class="used-in__label">{menu.name}</h3>
            <ul class="row-list" role="list">
              {dishes.map((g) => (
                <li key={g.menuDishId}>
                  <a class="list-row" href={paths.menu(menu.id)}>
                    <span class="list-row__main">
                      <span class="list-row__title">{g.dishName}</span>
                      <span class="list-row__meta">
                        {[
                          g.price !== null ? formatPence(g.price) : 'No price',
                          `costs ${formatPence(g.cost.perPortion)}${g.cost.missing.length ? '*' : ''}`,
                          g.target !== null ? `target ${g.target}%` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span class={g.belowTarget ? 'money-gp plan-flag' : 'money-gp'}>{g.gp !== null ? `${g.gp}%` : '–'}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {view.menus.some((m) => m.dishes.some((d) => d.cost.missing.length)) && <p class="field__hint">* Not every ingredient priced yet: see below.</p>}
      </section>

      {view.unpriced.length > 0 && (
        <section class="flow" aria-labelledby="money-prices">
          <h2 id="money-prices">Prices to add</h2>
          <p class="field__hint">Used on the menus, with no price. Tap one, then its product: pack and price.</p>
          <ul class="row-list" role="list">
            {view.unpriced.map((u) => (
              <li key={u.ingredientId}>
                <a class="list-row" href={paths.ingredient(u.ingredientId)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{u.name}</span>
                    <span class="list-row__meta">In {u.usedIn.join(', ')}</span>
                  </span>
                  <Icon name="chevron-right" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.recipes.length > 0 && (
        <details class="library-group">
          <summary class="library-group__summary">
            Recipe costs <span class="list-row__meta">{view.recipes.length}</span>
          </summary>
          <ul class="row-list" role="list">
            {view.recipes.map((r) => (
              <li key={r.componentId}>
                <a class="list-row" href={paths.component(r.componentId)}>
                  <span class="list-row__main">
                    <span class="list-row__title">{r.name}</span>
                    <span class="list-row__meta">
                      {costSummary(r.cost)}
                      {r.cost.missing.length ? ` · not costed: ${r.cost.missing.join(', ')}` : ''}
                    </span>
                  </span>
                  <Icon name="chevron-right" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section class="flow" aria-labelledby="money-week">
        <h2 id="money-week">This week</h2>
        <p class="menu-summary">
          {formatCalendarDate(view.week.start)} to {formatCalendarDate(view.week.end)}
        </p>
        {view.week.stock.length === 0 ? (
          <p>No counts yet this week.</p>
        ) : (
          <ul class="flow" role="list">
            {view.week.stock.map((s) => (
              <li key={s.section}>
                Stock on {s.section}: {formatPence(s.pence)}
                {s.date ? ` (counted ${formatCalendarDate(s.date)})` : ''}
                {s.uncosted ? `, ${s.uncosted} items not costed` : ''}
              </li>
            ))}
          </ul>
        )}
        <p>
          Waste: {formatPence(view.week.waste.pence)} from {view.week.waste.entries} {view.week.waste.entries === 1 ? 'entry' : 'entries'}
          {view.week.waste.uncosted ? ` (${view.week.waste.uncosted} not costed)` : ''}.
        </p>
        {view.week.waste.byReason.length > 0 && <p>By cause: {view.week.waste.byReason.map((r) => `${r.reason} ${formatPence(r.pence)}`).join(' · ')}</p>}
        <div class="cluster">
          <a class="button" href={paths.count}>
            Count
          </a>
          <a class="button" href={paths.waste}>
            Waste log
          </a>
          <a class="button" href={paths.report}>
            Weekly report
          </a>
        </div>
      </section>
    </section>
  );
}

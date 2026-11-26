import { useState } from 'preact/hooks';
import { CRITICAL_NAMES, LEGAL_LIMITS, readShelfLife, type CriticalKind } from '../../core/foodSafety/foodSafety';
import { formatMinutes } from '../../core/time/formatMinutes';
import { listComponents } from '../../data/components';
import { getTargets, listHouseRules, setShelfLife, setTarget } from '../../data/foodSafety';
import { getKitchen } from '../../data/kitchens';
import { getListItems } from '../../data/lists';
import type { Id, KitchenId } from '../../data/types';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { Icon } from '../icons';
import { paths } from '../router';
import { trackSave } from '../saveStatus';

const KINDS: CriticalKind[] = ['cooling', 'hot-hold', 'reheat'];
const PLACEHOLDERS: Record<CriticalKind, string> = {
  cooling: 'below 5°C within 90 min',
  'hot-hold': '63°C or above, 2 hrs max',
  reheat: '75°C core',
};

/** "3 days" → "Reads as 3 days"; how a shelf life will be used. */
function reads(text: string): string {
  if (!text.trim()) return '';
  const minutes = readShelfLife(text);
  if (minutes === null) return 'Can’t read that as a length of time: try “3 days” or “48 hrs”.';
  return minutes >= 1440 && minutes % 1440 === 0 ? `Reads as ${minutes / 1440} ${minutes === 1440 ? 'day' : 'days'}` : `Reads as ${formatMinutes(minutes)}`;
}

/**
 * A kitchen's house rules (SPEC → Food safety; FS2, FS3): targets for
 * critical points, and shelf lives by component type or by component.
 * Copied from the kitchen's HACCP or SFBB pack: the app never invents one.
 */
export function HouseRules({ kitchenId }: { kitchenId: KitchenId }) {
  const kitchen = useLiveQuery(() => getKitchen(kitchenId), [kitchenId]);
  const rules = useLiveQuery(() => listHouseRules(kitchenId), [kitchenId]);
  const targets = useLiveQuery(() => getTargets(kitchenId), [kitchenId]);
  const types = useLiveQuery(() => getListItems({ kind: 'values', list: 'component-types', kitchenId: null }));
  const components = useLiveQuery(() => listComponents());
  const [query, setQuery] = useState('');
  if (!rules || !targets || !types || !components) return null;

  const shelf = rules.filter((r) => r.kind === 'shelf-life');
  const componentRules = shelf.filter((r) => r.componentId);
  const matches = query.trim() ? components.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()) && !componentRules.some((r) => r.componentId === c.id)).slice(0, 8) : [];

  return (
    <section class="flow">
      <ScreenHeader title="House rules" back={{ href: paths.kitchen(kitchenId), label: kitchen?.name ?? 'Kitchen' }} />
      <p class="field__hint">From the kitchen’s own food safety pack (HACCP or SFBB). Mep shows these on steps and labels; it doesn’t replace the kitchen’s records.</p>

      <section class="flow" aria-labelledby="targets-title">
        <h2 class="section-label" id="targets-title">Critical points</h2>
        {KINDS.map((kind) => (
          <RuleField
            key={kind}
            id={`target-${kind}`}
            label={CRITICAL_NAMES[kind]}
            value={targets[kind] ?? ''}
            placeholder={PLACEHOLDERS[kind]}
            hint={`The legal limit in England: ${LEGAL_LIMITS[kind]}.`}
            onSave={(value) => setTarget(kitchenId, kind, value)}
          />
        ))}
      </section>

      <section class="flow" aria-labelledby="shelf-title">
        <h2 class="section-label" id="shelf-title">Shelf life by type</h2>
        {types
          .filter((t) => !t.hidden)
          .map((t) => (
            <RuleField
              key={t.id}
              id={`type-${t.id}`}
              label={t.name}
              value={shelf.find((r) => r.componentTypeId === t.id)?.value ?? ''}
              placeholder="3 days"
              explain={reads}
              onSave={(value) => setShelfLife(kitchenId, { componentTypeId: t.id }, value)}
            />
          ))}
      </section>

      <section class="flow" aria-labelledby="own-title">
        <h2 class="section-label" id="own-title">Shelf life for one component</h2>
        <p class="field__hint">Wins over its type’s.</p>
        {componentRules.map((rule) => (
          <RuleField
            key={rule.id}
            id={`component-${rule.componentId}`}
            label={components.find((c) => c.id === rule.componentId)?.name ?? 'A component'}
            value={rule.value}
            placeholder="2 days"
            explain={reads}
            onSave={(value) => setShelfLife(kitchenId, { componentId: rule.componentId as Id }, value)}
          />
        ))}
        <input class="input" type="search" aria-label="Find a component" placeholder="Find a component to give its own shelf life" autocomplete="off" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        <ul class="row-list" role="list">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                class="list-row"
                type="button"
                onClick={async () => {
                  await trackSave(setShelfLife(kitchenId, { componentId: c.id }, '1 day'));
                  setQuery('');
                }}
              >
                <span class="list-row__main">
                  <span class="list-row__title">{c.name}</span>
                </span>
                <Icon name="chevron-right" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function RuleField(props: { id: string; label: string; value: string; placeholder: string; hint?: string; explain?: (text: string) => string; onSave: (value: string) => Promise<void> }) {
  const [text, setText] = useState(props.value);
  const explained = props.explain?.(text);
  return (
    <div class="field">
      <label class="label" for={props.id}>
        {props.label}
      </label>
      <input
        class="input"
        id={props.id}
        autocomplete="off"
        placeholder={props.placeholder}
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
        onBlur={() => text !== props.value && trackSave(props.onSave(text))}
      />
      {(explained || props.hint) && <p class="field__hint">{explained || props.hint}</p>}
    </div>
  );
}

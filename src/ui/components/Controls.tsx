/**
 * Small controls built from LooseLeaf's markup: chips, segmented choices and
 * switches (UX → Editing rule 5: choices as chips and segmented controls,
 * no dropdowns).
 */

import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

interface Choice<T extends string | number> {
  value: T;
  label: string;
}

/** One-of-several as chips that wrap. Tapping the chosen chip again clears it if `allowNone`. */
export function ChipChoice<T extends string | number>(props: {
  label: string;
  choices: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  allowNone?: boolean;
  /** One row that scrolls sideways (filters that grow), instead of wrapping. */
  reel?: boolean;
}) {
  const { label, choices, value, onChange, allowNone, reel } = props;
  return (
    <div class="flow" style={{ '--flow-space': 'var(--space-2xs)' }}>
      <p class="label">{label}</p>
      <div
        class={reel ? 'reel' : 'cluster'}
        role={reel ? 'region' : 'group'}
        aria-label={label}
        tabIndex={reel ? 0 : undefined}
        style={reel ? undefined : { '--gutter': 'var(--space-2xs)' }}
      >
        {choices.map((choice) => {
          const chosen = choice.value === value;
          return (
            <button
              key={choice.value}
              class="chip"
              type="button"
              aria-pressed={chosen}
              onClick={() => onChange(chosen && allowNone ? null : choice.value)}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Several-of-several as chips (e.g. days of the week). */
export function ChipToggles<T extends string | number>(props: {
  label: string;
  choices: readonly Choice<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
}) {
  const { label, choices, values, onChange } = props;
  return (
    <div class="cluster" role="group" aria-label={label} style={{ '--gutter': 'var(--space-2xs)' }}>
      {choices.map((choice) => {
        const on = values.includes(choice.value);
        return (
          <button
            key={choice.value}
            class="chip"
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((v) => v !== choice.value) : [...values, choice.value])}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

/** A segmented control: LooseLeaf's radios drawn as joined buttons. */
export function Segmented<T extends string | number>(props: {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { label, choices, value, onChange } = props;
  const name = useId();
  return (
    <fieldset class="choice-group" data-variant="segmented" aria-label={label}>
      {choices.map((choice) => {
        const id = `${name}-${choice.value}`;
        return [
          <input
            key={`${id}-input`}
            class="visually-hidden"
            type="radio"
            id={id}
            name={name}
            checked={choice.value === value}
            onChange={() => onChange(choice.value)}
          />,
          <label key={`${id}-label`} for={id}>
            {choice.label}
          </label>,
        ];
      })}
    </fieldset>
  );
}

/** An on/off switch (LooseLeaf .choice[data-variant="switch"]). */
export function Switch(props: { checked: boolean; onChange: (checked: boolean) => void; children: ComponentChildren }) {
  return (
    <label class="choice" data-variant="switch">
      <input
        class="choice__input"
        type="checkbox"
        role="switch"
        // Safari draws its native switch from this attribute.
        {...{ switch: true }}
        checked={props.checked}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      <span class="choice__thumb" aria-hidden="true" />
      {props.children}
    </label>
  );
}

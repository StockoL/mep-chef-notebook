import { Icon } from '../icons';
import { SaveIndicator } from './SaveIndicator';

interface ScreenHeaderProps {
  title: string;
  /** Where back goes, and its name: "‹ Settings" (UX → Navigation rule 3). */
  back?: { href: string; label: string };
  /** One text action at the top right: "Edit" on a reading view, "Done" in edit mode. */
  action?: { label: string; onClick: () => void };
  /** A small line under the title: "Sauces and emulsions · in Cured trout". */
  meta?: string;
}

/**
 * The top of a screen pushed from a tab: a back link that names where it
 * goes, the title, and the save indicator for anything changed on the screen.
 */
export function ScreenHeader({ title, back, action, meta }: ScreenHeaderProps) {
  return (
    <header class="screen-header">
      <div class="screen-header__bar">
        {back ? (
          <a class="screen-header__back" href={back.href}>
            <Icon name="chevron-left" />
            {back.label}
          </a>
        ) : (
          <span />
        )}
        <span class="screen-header__end">
          <SaveIndicator />
          {action && (
            <button class="screen-header__action" type="button" onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </span>
      </div>
      <h1>{title}</h1>
      {meta && <p class="screen-header__meta">{meta}</p>}
    </header>
  );
}

/**
 * The end of an edit screen: a deliberate way out, and a reminder that
 * nothing more is needed to save.
 */
export function DoneFooter({ href }: { href: string }) {
  return (
    <div class="done-footer flow">
      <p class="field__hint">Changes save as you go.</p>
      <a class="button" data-variant="primary" href={href}>
        Done
      </a>
    </div>
  );
}

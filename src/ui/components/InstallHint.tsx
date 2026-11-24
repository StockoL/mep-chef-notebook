import { useState } from 'preact/hooks';
import { Icon } from '../icons';
import { isInstalled, isIos } from '../platform';

/** Remembered only until the app is closed: the hint comes back until Mep is installed (UX → First run). */
const DISMISSED_KEY = 'mep.installHintDismissed';

/**
 * iPhone never offers to install a web app, so show how (DECISIONS 21).
 * Shown in Safari on iPhone or iPad when Mep isn't opened from the Home Screen.
 */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === '1');

  if (dismissed || !isIos() || isInstalled()) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <aside class="card" aria-labelledby="install-hint-title">
      <div class="card__body flow">
        <h2 id="install-hint-title">Add Mep to your Home Screen</h2>
        <p>
          Mep keeps your notebook on this phone. Added to your Home Screen, it opens like an app, works offline, and
          your notebook is far safer from being cleared.
        </p>
        <ol class="flow">
          <li>
            Tap Share <Icon name="share" /> in Safari (in the <strong>•••</strong> menu if you can't see it).
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>. You may need to scroll down or tap <strong>View More</strong>.
          </li>
          <li>Open Mep from your Home Screen.</li>
        </ol>
        <button class="button" type="button" data-variant="secondary" onClick={dismiss}>
          Not now
        </button>
      </div>
    </aside>
  );
}

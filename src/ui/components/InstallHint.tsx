import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../icons';
import { iosBrowser, isInstalled, isIos, type IosBrowser } from '../platform';

/** Remembered only until the app is closed: the hint comes back until Mep is installed (UX → First run). */
const DISMISSED_KEY = 'mep.installHintDismissed';

/** Where the Share button is, in each iPhone browser. */
const SHARE_PLACE: Record<IosBrowser, string> = {
  safari: "in Safari's toolbar (in the ••• menu if you can't see it)",
  chrome: "in Chrome's address bar (or in the ••• menu)",
  firefox: "in Firefox's menu (☰)",
  edge: "in Edge's menu (•••)",
};

const SHOW_AGAIN = 'mep-install-hint-again';

/** Dismissed this session: Today's "Needs you" then offers it instead (FEEL_PASS 5). */
export function installHintDismissed(): boolean {
  return sessionStorage.getItem(DISMISSED_KEY) === '1';
}

/** "Add Mep to your Home Screen" from "Needs you": show the steps again. */
export function clearInstallHintDismissal() {
  sessionStorage.removeItem(DISMISSED_KEY);
  window.dispatchEvent(new Event(SHOW_AGAIN));
}

/**
 * iPhone never offers to install a web app, so show how (DECISIONS 21).
 * Shown in any iPhone or iPad browser when Mep isn't opened from the Home Screen.
 */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(installHintDismissed);
  useEffect(() => {
    const again = () => setDismissed(false);
    window.addEventListener(SHOW_AGAIN, again);
    return () => window.removeEventListener(SHOW_AGAIN, again);
  }, []);

  if (dismissed || !isIos() || isInstalled()) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <aside class="card" aria-labelledby="install-hint-title">
      <div class="card__body flow">
        <h2 class="section-label" id="install-hint-title">Add Mep to your Home Screen</h2>
        <p>
          Mep keeps your notebook on this phone. Added to your Home Screen, it opens full screen like an app, works
          offline, and your notebook is far safer from being cleared.
        </p>
        <ol class="flow">
          <li>
            Tap Share <Icon name="share" /> {SHARE_PLACE[iosBrowser()]}.
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>. You may need to scroll down or tap <strong>View More</strong>.
          </li>
          <li>Open Mep from your Home Screen, and use it from there from now on.</li>
        </ol>
        <p>
          The Home Screen app keeps its own notebook, separate from this browser tab, so anything added here won't
          appear there.
        </p>
        <button class="button" type="button" onClick={dismiss}>
          Not now
        </button>
      </div>
    </aside>
  );
}

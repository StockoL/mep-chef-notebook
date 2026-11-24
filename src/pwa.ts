import { registerSW } from 'virtual:pwa-register';

/**
 * The service worker saves the app on the phone so it opens offline, and
 * fetches new versions in the background. It never touches IndexedDB, so an
 * update can't change stored data.
 *
 * When a new version is ready, it takes over only when that can't interrupt
 * anything (SPEC: "updates arrive the next time the app opens"):
 * - within a few seconds of opening the app (nothing typed yet): straight away;
 * - otherwise, the next time the app is put in the background.
 * Either way the page reloads once, quietly.
 */

/** How long after opening still counts as "just opened". */
const JUST_OPENED_MS = 4000;

export function setUpServiceWorker(): void {
  const openedAt = performance.now();
  let updateWaiting = false;

  const applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (performance.now() - openedAt < JUST_OPENED_MS) {
        void applyUpdate(true);
      } else {
        updateWaiting = true;
      }
    },
    onRegisteredSW(_url, registration) {
      // iPhones rarely look for updates on their own: look whenever the app comes back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration?.update();
      });
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && updateWaiting) {
      updateWaiting = false;
      void applyUpdate(true);
    }
  });
}

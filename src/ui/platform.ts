/** What the app is running on. Browser-only, so it lives in the UI, not src/core. */

/** iPhone or iPad (iPads report themselves as a Mac with a touch screen). */
export function isIos(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  return /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1);
}

/** Opened from the Home Screen rather than a browser tab. */
export function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || matchMedia('(display-mode: standalone)').matches;
}

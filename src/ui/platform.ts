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

export type IosBrowser = 'safari' | 'chrome' | 'firefox' | 'edge';

/**
 * Which browser an iPhone is using, from its user agent. They all run Safari's
 * engine, but put the Share button in different places. Since iOS 16.4 each of
 * them can add a web app to the Home Screen.
 */
export function iosBrowser(userAgent: string = navigator.userAgent): IosBrowser {
  if (userAgent.includes('CriOS')) return 'chrome';
  if (userAgent.includes('FxiOS')) return 'firefox';
  if (userAgent.includes('EdgiOS')) return 'edge';
  return 'safari';
}

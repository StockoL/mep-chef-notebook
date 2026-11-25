import { useEffect, useState } from 'preact/hooks';

/**
 * Keeps the screen on while the component is shown (SM4: a phone on the
 * shelf, greasy fingers). Uses the Screen Wake Lock API; the browser drops
 * the lock when the app goes to the background, so it's asked for again
 * whenever the app comes back. Says whether it's holding.
 */
export function useWakeLock(): 'on' | 'unsupported' | 'off' {
  const [state, setState] = useState<'on' | 'unsupported' | 'off'>('off');

  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      setState('unsupported');
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!active) {
          await lock.release();
          return;
        }
        setState('on');
        lock.addEventListener('release', () => active && setState('off'));
      } catch {
        // Low battery mode, or the page isn't visible: try again when it is.
        setState('off');
      }
    };
    const onVisible = () => void request();
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);

  return state;
}

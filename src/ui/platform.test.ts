import { describe, expect, it } from 'vitest';
import { iosBrowser } from './platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';

describe('iosBrowser', () => {
  it('recognises Chrome, Firefox and Edge on iPhone', () => {
    expect(iosBrowser(`${IPHONE} CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1`)).toBe('chrome');
    expect(iosBrowser(`${IPHONE} FxiOS/133.0 Mobile/15E148 Safari/605.1.15`)).toBe('firefox');
    expect(iosBrowser(`${IPHONE} EdgiOS/131.0.2903.68 Version/18.0 Mobile/15E148 Safari/604.1`)).toBe('edge');
  });

  it('treats anything else as Safari', () => {
    expect(iosBrowser(`${IPHONE} Version/18.0 Mobile/15E148 Safari/604.1`)).toBe('safari');
  });
});

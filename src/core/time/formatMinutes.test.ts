import { describe, expect, it } from 'vitest';
import { formatMinutes } from './formatMinutes';

describe('formatMinutes', () => {
  it('shows an hour and a half as "1h 30"', () => {
    expect(formatMinutes(90)).toBe('1h 30');
  });

  // TODO(Louis): one `it(...)` per case in the comment in formatMinutes.ts,
  // plus your own edge cases. Each test checks one thing and says what in
  // its name.
});

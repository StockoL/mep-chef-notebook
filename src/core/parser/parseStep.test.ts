import { describe, expect, it } from 'vitest';
import { parseStep } from './parseStep';

describe('parseStep (stub)', () => {
  it('keeps the text and leaves the mode unread', () => {
    expect(parseStep('  simmer 2½ hrs, skim ')).toEqual({
      text: 'simmer 2½ hrs, skim',
      mode: null,
    });
  });
});

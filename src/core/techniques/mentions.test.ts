import { describe, expect, it } from 'vitest';
import { findMentions, mentionedIds } from './mentions';

const techniques = [
  { id: 'q', name: 'Quenelle', aliases: ['rocher'] },
  { id: 'b', name: 'Blanch', aliases: [] },
  { id: 'bn', name: 'Beurre noisette', aliases: ['brown butter'] },
  { id: 'j', name: 'Julienne', aliases: [] },
  { id: 'm', name: 'Macédoine', aliases: [] },
];

describe('technique mentions', () => {
  it('splits a step into plain and linked pieces, keeping the wording', () => {
    expect(findMentions('Quenelles of mousse, two per plate', techniques)).toEqual([
      { text: 'Quenelles', techniqueId: 'q' },
      { text: ' of mousse, two per plate', techniqueId: null },
    ]);
  });

  it('finds the usual endings and aliases, longest name first', () => {
    expect(mentionedIds('Blanched leeks, then blanching the beans', techniques)).toEqual(['b']);
    expect(mentionedIds('Finish with brown butter', techniques)).toEqual(['bn']);
    expect(mentionedIds('Make a beurre noisette', techniques)).toEqual(['bn']);
    expect(mentionedIds('rocher of ice cream', techniques)).toEqual(['q']);
  });

  it('ignores accents and case, but only whole words', () => {
    expect(mentionedIds('MACEDOINE of veg', techniques)).toEqual(['m']);
    expect(mentionedIds('Celeriac, julienned', techniques)).toEqual(['j']);
    expect(mentionedIds('blanchette of veal', techniques)).toEqual([]);
  });

  it('returns the text whole when there are no techniques', () => {
    expect(findMentions('Roast bones', [])).toEqual([{ text: 'Roast bones', techniqueId: null }]);
  });

  it('doesn’t link a technique word inside an ingredient or component name', () => {
    const withPuree = [...techniques, { id: 'p', name: 'Purée', aliases: ['puree'] }];
    expect(mentionedIds('Add mirepoix and tom puree, roast', withPuree, ['Tom puree', 'Mirepoix'])).toEqual([]);
    expect(mentionedIds('Purée the carrots, add tom puree', withPuree, ['Tom puree'])).toEqual(['p']);
  });
});

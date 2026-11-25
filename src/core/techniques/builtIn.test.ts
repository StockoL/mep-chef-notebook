import { describe, expect, it } from 'vitest';
import { readMethod } from '../parser/parseStep';
import { whatsMissing } from '../parser/readiness';
import { BUILT_IN_TECHNIQUES, BUILT_IN_TEMPLATES } from './builtIn';

/**
 * Phase 4's done-when for templates (T3): a template's steps must be read
 * completely, so a recipe made from one is ready once the chef confirms.
 */
describe('built-in method templates', () => {
  for (const template of BUILT_IN_TEMPLATES) {
    it(`${template.technique}: every step is read completely`, () => {
      const parts = readMethod(template.steps);
      const missing = whatsMissing(
        template.steps.map((text, i) => ({
          text,
          confirmed: true,
          parts: parts[i]!.map((p) => ({ text: p.text, mode: p.mode, minutesMin: p.minutes?.min ?? null, equipment: p.equipment, atService: p.atService, hold: p.hold })),
        })),
      );
      expect(missing.map((m) => `${m.text} (${template.steps[m.step]})`)).toEqual([]);
    });
  }

  it('belongs to a built-in technique', () => {
    const names = new Set(BUILT_IN_TECHNIQUES.map((t) => t.name));
    expect(BUILT_IN_TEMPLATES.filter((t) => !names.has(t.technique))).toEqual([]);
  });

  it('has no technique name twice', () => {
    const all = BUILT_IN_TECHNIQUES.flatMap((t) => [t.name, ...t.aliases].map((n) => n.toLowerCase()));
    expect(all.filter((n, i) => all.indexOf(n) !== i)).toEqual([]);
  });
});

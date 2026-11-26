/**
 * Helper text, shown until it has done its job once (FEEL_PASS 4, UX
 * principle 4: teach once).
 *
 * - Under a field (`field` with `empty`): shows while the field is empty and
 *   the chef hasn't used this kind of field before; the first time it has
 *   content, the hint is marked seen.
 * - About a screen (no `field`): shows on the first visit only; marked seen
 *   when the chef leaves.
 *
 * Whether it was seen is read once, when the hint first appears, so it
 * doesn't vanish mid-visit.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { markHintSeen, seenHints } from '../../data/hints';

export function Hint({ name, field = false, empty = true, children }: { name: string; field?: boolean; empty?: boolean; children: ComponentChildren }) {
  const [seen, setSeen] = useState<boolean | null>(null);
  const shown = useRef(false);
  useEffect(() => {
    let live = true;
    void seenHints().then((names) => live && setSeen(names.includes(name)));
    return () => {
      live = false;
    };
  }, [name]);
  // A field: used once is seen.
  useEffect(() => {
    if (field && !empty) void markHintSeen(name);
  }, [field, empty, name]);
  // A screen: seen once it has been shown and left.
  useEffect(() => () => void (!field && shown.current && markHintSeen(name)), [field, name]);

  const visible = seen === false && (!field || empty);
  if (visible) shown.current = true;
  return visible ? <p class="field__hint">{children}</p> : null;
}

import { listComponents } from '../../data/components';
import { useLiveQuery } from '../hooks/useLiveQuery';

/**
 * Library tab. Phase 2 builds the cookbook (dishes, components, ingredients,
 * techniques, search). For now it lists the draft components made from
 * inbox notes, so nothing sorted there goes missing.
 */
export function Library() {
  const components = useLiveQuery(() => listComponents());
  return (
    <section class="flow">
      <h1>Library</h1>
      {components?.length === 0 ? (
        <div class="empty-state flow">
          <p>Your dishes, components, ingredients and techniques will live here.</p>
          <p class="empty-state__hint">Sort a note from the inbox into a new component to start.</p>
        </div>
      ) : (
        <>
          <h2>Components</h2>
          <ul class="row-list" role="list">
            {components?.map((component) => (
              <li key={component.id} class="list-row" data-static>
                <span class="list-row__main">
                  <span class="list-row__title">{component.name}</span>
                  <span class="list-row__meta">Draft</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

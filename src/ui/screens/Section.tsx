import { DataCheck } from '../components/DataCheck';

// Section tab. Built in Phase 11; the waste log starts in Phase 1.
// Holds the temporary Phase 0 check until App settings exists (Phase 1).
export function Section() {
  return (
    <section class="flow">
      <h1>Section</h1>
      <p>Stock counts, pars, checklists and your waste log for your section.</p>
      <DataCheck />
    </section>
  );
}

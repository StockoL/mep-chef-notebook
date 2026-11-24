import { InstallHint } from '../components/InstallHint';

// Today tab. The home screen; filled in from Phase 1 (capture) and Phase 3 (the sheet).
export function Today() {
  return (
    <section class="flow">
      <InstallHint />
      <h1>Today</h1>
      <p>Today's sheet will appear here, with your next service and anything that needs you.</p>
    </section>
  );
}

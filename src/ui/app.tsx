import { LocationProvider, Route, Router } from 'preact-iso';
import { CaptureBar } from './components/CaptureBar';
import { TabBar } from './components/TabBar';
import { TopBar } from './components/TopBar';
import { IconSheet } from './icons';
import { BASE, paths } from './router';
import { Library } from './screens/Library';
import { Plan } from './screens/Plan';
import { Section } from './screens/Section';
import { Today } from './screens/Today';

/**
 * The app shell (docs/UX.md → Navigation): top bar, the current screen, and a
 * dock at the bottom holding the capture bar above the tab bar.
 *
 * LocationProvider tracks the URL; `scope` tells it to handle only links
 * inside the app's own path. Router shows whichever Route matches.
 */
export function App() {
  return (
    <LocationProvider scope={BASE}>
      <IconSheet />
      <div class="app-shell">
        <TopBar />
        <main class="app-shell__main">
          <Router>
            <Route path={paths.today} component={Today} />
            <Route path={paths.library} component={Library} />
            <Route path={paths.plan} component={Plan} />
            <Route path={paths.section} component={Section} />
            {/* Any unknown path inside the app shows Today: no dead ends. */}
            <Route default component={Today} />
          </Router>
        </main>
        <div class="app-shell__dock">
          <CaptureBar />
          <TabBar />
        </div>
      </div>
    </LocationProvider>
  );
}

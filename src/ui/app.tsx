import { LocationProvider, Route, Router } from 'preact-iso';
import { isFirstRunDone } from '../data/firstRun';
import { CaptureBar } from './components/CaptureBar';
import { TabBar } from './components/TabBar';
import { TopBar } from './components/TopBar';
import { UndoBar } from './components/UndoBar';
import { useLiveQuery } from './hooks/useLiveQuery';
import { IconSheet } from './icons';
import { BASE, paths, routes } from './router';
import { FirstRun } from './screens/FirstRun';
import { Inbox } from './screens/Inbox';
import { KitchenPart, KitchenSections, KitchenServices, Kitchens, KitchenSettings, ServiceTimes } from './screens/Kitchens';
import { Library } from './screens/Library';
import { Plan } from './screens/Plan';
import { Goal, Section, WasteLog } from './screens/SectionScreens';
import { Settings } from './screens/Settings';
import { SettingsList } from './screens/SettingsList';
import { Today } from './screens/Today';

/**
 * The app shell (docs/UX.md → Navigation): top bar, the current screen, and a
 * dock at the bottom holding the capture bar above the tab bar. On the very
 * first open, the first-run screens come first (F1).
 *
 * LocationProvider tracks the URL; `scope` tells it to handle only links
 * inside the app's own path. Router shows the first Route that matches.
 */
export function App() {
  const firstRunDone = useLiveQuery(() => isFirstRunDone());

  return (
    <LocationProvider scope={BASE}>
      <IconSheet />
      {firstRunDone === false ? (
        // Finishing first run saves a setting; the live query then shows the app.
        <FirstRun onDone={() => history.replaceState(null, '', paths.today)} />
      ) : (
        <div class="app-shell">
          <TopBar />
          <main class="app-shell__main">
            <Router>
              <Route path={paths.today} component={Today} />
              <Route path={paths.inbox} component={Inbox} />
              <Route path={paths.library} component={Library} />
              <Route path={paths.plan} component={Plan} />
              <Route path={paths.section} component={Section} />
              <Route path={paths.waste} component={WasteLog} />
              <Route path={paths.goal} component={Goal} />
              <Route path={paths.settings} component={Settings} />
              <Route path={routes.settingsList} component={SettingsList} />
              <Route path={paths.kitchens} component={Kitchens} />
              <Route path={routes.kitchen} component={KitchenSettings} />
              <Route path={routes.kitchenSections} component={KitchenSections} />
              <Route path={routes.kitchenServices} component={KitchenServices} />
              <Route path={routes.service} component={ServiceTimes} />
              <Route path={routes.kitchenPart} component={KitchenPart} />
              {/* Any unknown path inside the app shows Today: no dead ends. */}
              <Route default component={Today} />
            </Router>
          </main>
          <div class="app-shell__dock">
            <UndoBar />
            <CaptureBar />
            <TabBar />
          </div>
        </div>
      )}
    </LocationProvider>
  );
}

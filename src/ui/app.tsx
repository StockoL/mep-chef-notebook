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
import { ComponentPage, DishPage, IngredientPage } from './screens/LibraryPages';
import { Notes } from './screens/Notes';
import { EventEditor, Events } from './screens/Events';
import { SectionList } from './screens/SectionList';
import { PaperEntry, SheetScreen, SheetsList } from './screens/Sheets';
import { Plan } from './screens/Plan';
import { Goal, Labels, Section, WasteLog } from './screens/SectionScreens';
import { Settings } from './screens/Settings';
import { SettingsList } from './screens/SettingsList';
import { Today } from './screens/Today';
import { WordList } from './screens/WordList';
import { ComponentCompare, ComponentHistory } from './screens/ComponentHistory';
import { MenuScreen, MenusList } from './screens/Menus';
import { TechniquePage } from './screens/TechniquePage';
import { Prep } from './screens/Prep';
import { AllergenMatrix, Checklists, Count, Orders, WeeklyReportScreen } from './screens/SectionAdmin';
import { Money } from './screens/Money';

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
              <Route path={paths.notes} component={Notes} />
              <Route path={paths.sheets} component={SheetsList} />
              <Route path={routes.sheetPaper} component={PaperEntry} />
              <Route path={routes.sheet} component={SheetScreen} />
              <Route path={paths.sectionList} component={SectionList} />
              <Route path={paths.library} component={Library} />
              <Route path={paths.menus} component={MenusList} />
              <Route path={routes.menu} component={MenuScreen} />
              <Route path={routes.componentHistory} component={ComponentHistory} />
              <Route path={routes.componentCompare} component={ComponentCompare} />
              <Route path={routes.component} component={ComponentPage} />
              <Route path={routes.dish} component={DishPage} />
              <Route path={routes.ingredient} component={IngredientPage} />
              <Route path={routes.technique} component={TechniquePage} />
              <Route path={paths.plan} component={Plan} />
              <Route path={paths.prep} component={Prep} />
              <Route path={paths.section} component={Section} />
              <Route path={paths.waste} component={WasteLog} />
              <Route path={paths.labels} component={Labels} />
              <Route path={paths.count} component={Count} />
              <Route path={paths.orders} component={Orders} />
              <Route path={paths.checklists} component={Checklists} />
              <Route path={paths.report} component={WeeklyReportScreen} />
              <Route path={paths.money} component={Money} />
              <Route path={routes.matrix} component={AllergenMatrix} />
              <Route path={paths.goal} component={Goal} />
              <Route path={paths.settings} component={Settings} />
              <Route path={routes.settingsList} component={SettingsList} />
              <Route path={paths.wordList} component={WordList} />
              <Route path={paths.kitchens} component={Kitchens} />
              <Route path={routes.kitchen} component={KitchenSettings} />
              <Route path={routes.kitchenSections} component={KitchenSections} />
              <Route path={routes.kitchenServices} component={KitchenServices} />
              <Route path={routes.service} component={ServiceTimes} />
              <Route path={routes.event} component={EventEditor} />
              <Route path={routes.events} component={Events} />
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

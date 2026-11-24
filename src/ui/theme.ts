/**
 * Dark mode (F3). LooseLeaf's theme.js reads localStorage "theme" before the
 * first paint and sets data-theme on <html>; this writes the same key, so the
 * choice applies now and on every later start. It's a setting of this phone,
 * so it lives in localStorage, not in the notebook's data.
 */

export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'theme';

export function getTheme(): ThemeChoice {
  const stored = localStorage.getItem(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'auto';
}

export function setTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'auto') {
    localStorage.removeItem(KEY);
    delete root.dataset.theme;
  } else {
    localStorage.setItem(KEY, choice);
    root.dataset.theme = choice;
  }
}

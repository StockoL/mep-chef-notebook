import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// Vitest's defineConfig is Vite's, plus a `test` section: one config for both.
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

/** The app's permanent path on GitHub Pages (DECISIONS 27). */
const BASE = '/mep-chef-notebook/';

/**
 * Puts LooseLeaf's theme.js inside a <script> in <head>.
 *
 * theme.js must run before the first paint, or the page flashes light before
 * switching to dark. A blocking script in <head> does that, and inlining it
 * means no extra file to fetch or cache. The package's `exports` don't list
 * dist/theme.js, so we find the package folder through its package.json
 * (which is exported) and read the file from disk.
 */
function inlineThemeScript(): Plugin {
  const require = createRequire(import.meta.url);
  const packageDir = dirname(require.resolve('looseleaf-ui/package.json'));
  const themePath = join(packageDir, 'dist', 'theme.js');

  return {
    name: 'mep:inline-theme-script',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: readFileSync(themePath, 'utf8'),
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

/**
 * HTTPS for testing on a phone. Service workers and crypto.randomUUID() need
 * a secure context, which a phone reaching http://192.168.x.x doesn't have.
 * When mkcert's files exist in .cert/ (README → Testing on a phone), dev and
 * preview serve https; otherwise plain http, which is fine on this computer.
 */
const certDir = new URL('./.cert/', import.meta.url);
const https = existsSync(new URL('cert.pem', certDir))
  ? { cert: readFileSync(new URL('cert.pem', certDir)), key: readFileSync(new URL('key.pem', certDir)) }
  : undefined;

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  // The same base is used in dev and preview, so paths, the service worker's
  // scope and routes behave the same everywhere.
  base: BASE,
  plugins: [
    preact(),
    inlineThemeScript(),
    VitePWA({
      // A new version installs in the background and waits; src/pwa.ts decides
      // when it takes over (never mid-task). Updates never touch IndexedDB.
      registerType: 'prompt',
      injectRegister: false, // src/pwa.ts registers it
      // Icons and splash screens from pwa-assets.config.ts, added to the
      // manifest and to <head> automatically.
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        id: BASE,
        name: "Mep: chef's notebook and prep planner",
        short_name: 'Mep',
        description: "A chef's notebook and prep planner. Your data stays on your phone.",
        lang: 'en-GB',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#f9f4f0', // --color-surface-sunken (light)
        theme_color: '#ffffff', // --color-surface-raised (light): the top bar
      },
      workbox: {
        // Everything the app needs to open offline is saved on install.
        globPatterns: ['**/*.{js,css,html,svg,png}'], // the plugin adds the manifest itself
        // iOS fetches its one splash screen when Mep is added to the Home
        // Screen; caching all 64 on every phone would waste space.
        globIgnores: ['**/apple-splash-*'],
        // Any page inside the app opens the app shell when offline.
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false }, // test offline with `npm run build && npm run preview`
    }),
  ],
  // Replaced in the code at build time (declared in src/env.d.ts).
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    host: true, // listen on the local network so a phone can reach it
    https,
  },
  preview: {
    host: true,
    https,
  },
  test: {
    // Tests sit next to the code they test: formatMinutes.ts → formatMinutes.test.ts
    include: ['src/**/*.test.{ts,tsx}'],
    // src/core is pure logic, so plain Node is enough: no browser, no DOM.
    environment: 'node',
    // An in-memory IndexedDB, installed before any test file loads, so the
    // app's own database (created when db.ts is imported) has one to use.
    setupFiles: ['fake-indexeddb/auto'],
  },
});

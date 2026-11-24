import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
// Vitest's defineConfig is Vite's, plus a `test` section: one config for both.
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

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

// The app lives at https://stockol.github.io/mep-chef-notebook/ permanently.
// The same base is used in dev and preview, so paths, the service worker's
// scope and routes behave the same everywhere.
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  base: '/mep-chef-notebook/',
  plugins: [preact(), inlineThemeScript()],
  // Replaced in the code at build time (declared in src/env.d.ts).
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    host: true, // listen on the local network so a phone can reach it
  },
  preview: {
    host: true,
  },
  test: {
    // Tests sit next to the code they test: formatMinutes.ts → formatMinutes.test.ts
    include: ['src/**/*.test.{ts,tsx}'],
    // src/core is pure logic, so plain Node is enough: no browser, no DOM.
    environment: 'node',
  },
});

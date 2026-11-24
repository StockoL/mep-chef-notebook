import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
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
export default defineConfig({
  base: '/mep-chef-notebook/',
  plugins: [preact(), inlineThemeScript()],
  server: {
    host: true, // listen on the local network so a phone can reach it
  },
  preview: {
    host: true,
  },
});

import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The app lives at https://<user>.github.io/mep-chef-notebook/ permanently.
// The same base is used in dev and preview, so paths, the service worker's
// scope and routes behave the same everywhere.
export default defineConfig({
  base: '/mep-chef-notebook/',
  plugins: [preact()],
  server: {
    host: true, // listen on the local network so a phone can reach it
  },
  preview: {
    host: true,
  },
});

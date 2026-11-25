# Mep

Chef's notebook and prep planner.

A local-first notebook for working chefs: quick capture, dishes, components and ingredients, variations and versions, a parser that reads kitchen shorthand, and a prep scheduler that tells you what to start first.

Your data stays on your device. No account, no server.

**Use it:** https://stockol.github.io/mep-chef-notebook/ (on iPhone, open it in Safari and add it to your Home Screen).

Status: Phase 2 (library). See `docs/SPEC.md` and `docs/BUILD_ORDER.md`.

## Development

Needs Node 24.

```
npm install
npm run dev            # dev server at http://localhost:5173/mep-chef-notebook/
npm test               # unit tests (Vitest), once
npm run test:watch     # unit tests, re-run on save
npm run typecheck      # TypeScript, app and config
npm run build          # production build into dist/ (type-checks first)
npm run preview        # serve dist/ at http://localhost:4173/mep-chef-notebook/
```

Every push to `main` runs the tests, builds, and publishes to GitHub Pages (`.github/workflows/deploy.yml`).

The service worker only exists in the production build, so test offline behaviour with `npm run build && npm run preview`, not `npm run dev`.

## Where your data lives

Everything is stored in the browser's IndexedDB, which belongs to the address the app was opened from. The Pages address above is the permanent one: **install from there for real use.** A copy installed from a development address (below) has its own, separate data.

Export (a `.zip`, format in `docs/EXPORT_FORMAT.md`) is the backup: ••• → App settings → Back up now. Import is there too.

## Testing on a phone

A phone can't install or use offline a page served over plain `http://192.168.x.x`: service workers and `crypto.randomUUID()` need HTTPS. Two ways:

**Easiest: push and use Pages.** Every push to `main` is live at the Pages address within a couple of minutes.

**Before pushing: HTTPS on your own network with mkcert.** One-off setup on Windows:

1. Install mkcert: `winget install FiloSottile.mkcert` (or `choco install mkcert`).
2. `mkcert -install` adds a local certificate authority to Windows.
3. Find the computer's address on your Wi-Fi: `ipconfig` → IPv4 Address, e.g. `192.168.1.20`.
4. From the repo root:
   ```
   mkdir .cert
   mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem localhost 127.0.0.1 192.168.1.20
   ```
   `.cert/` is git-ignored. When it exists, `npm run dev` and `npm run preview` serve HTTPS automatically.
5. Make the iPhone trust it: `mkcert -CAROOT` shows a folder; send `rootCA.pem` from it to the phone (email or iCloud Drive) and open it. Then Settings → General → VPN & Device Management → install the profile, and Settings → General → About → Certificate Trust Settings → turn on mkcert.
6. `npm run build && npm run preview`, then open `https://192.168.1.20:4173/mep-chef-notebook/` in Safari. Allow Node through the Windows firewall if asked.

If the computer's address changes, repeat step 4 with the new one.

## Checks on a phone

1. **Install.** Open the app in Safari (or Chrome): the "Add Mep to your Home Screen" card shows on Today. Follow it, then open Mep from the Home Screen. ••• → App settings → Storage says "Home Screen".
2. **Offline.** Turn on Airplane Mode, close Mep fully (swipe it away), and open it again. It opens, and every tab works.
3. **Back up and restore.** App settings → Back up now → Save to Files. Then Import a backup… → that file → confirm. Photos and voice notes come back too.
4. **Storage kept.** App settings → Write test marker. Leave Mep unopened for 4–7 days, then check the marker still shows the date it was written.
5. **Updates.** After a new version is pushed, open Mep: within a few seconds it reloads once on its own (or the next time it's put in the background), and nothing is lost.

## Licence

Open source; licence to be chosen before the first public release.

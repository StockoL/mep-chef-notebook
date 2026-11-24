import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
  type AppleDeviceName,
} from '@vite-pwa/assets-generator/config';

/**
 * Icons and iOS splash screens, generated at build time from one SVG by
 * vite-plugin-pwa (vite.config.ts → pwaAssets). Nothing generated is committed.
 *
 * Colours are literal here because PNGs can't read CSS tokens:
 *   #b84400 = --action-500 (the icon)
 *   #f9f4f0 / #292623 = --color-surface-sunken, light / dark (the app's background)
 */
const ICON_ORANGE = '#b84400';
const PAGE_LIGHT = '#f9f4f0';
const PAGE_DARK = '#292623';

/** iPhones that run iOS 17.4 or later (LooseLeaf's minimum), plus iPads in use. */
const DEVICES: AppleDeviceName[] = [
  'iPhone 17 Pro Max', 'iPhone 17 Pro', 'iPhone Air', 'iPhone 17',
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16', 'iPhone 16e',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone SE 4.7"',
  'iPad Pro 12.9"', 'iPad Pro 11"', 'iPad Air 10.9"', 'iPad 10.2"', 'iPad mini 8.3"',
];

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: combinePresetAndAppleSplashScreens(
    {
      ...minimal2023Preset,
      // The SVG is already full bleed with the M inside the safe zone, so no
      // extra padding: Android's mask and iOS's rounding crop the orange.
      maskable: { sizes: [512], padding: 0, resizeOptions: { background: ICON_ORANGE } },
      apple: { sizes: [180], padding: 0, resizeOptions: { background: ICON_ORANGE } },
    },
    {
      // Splash: the icon, small, on the app's own background, light and dark.
      padding: 0.4,
      resizeOptions: { background: PAGE_LIGHT, fit: 'contain' },
      darkResizeOptions: { background: PAGE_DARK, fit: 'contain' },
      linkMediaOptions: { log: false, addMediaScreen: true, xhtml: false },
    },
    DEVICES,
  ),
  images: ['public/favicon.svg'],
});

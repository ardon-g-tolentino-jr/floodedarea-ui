import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Build stamp — surfaced in the UI so we can tell which build is loaded. Re-evaluated on every
// `vite build` and dev-server start, so the timestamp/commit change each build.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
let buildCommit = 'dev';
try {
  buildCommit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  /* not a git checkout — keep "dev" */
}
const buildTime = new Date().toISOString();

// In dev, the app calls `/api/*` and Vite proxies it to baha-api (default :8083).
// Point VITE_API_URL at the json-server mock (:3001) for offline UI work.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:8083';

  return {
    plugins: [
      react(),
      // PWA support — the prerequisite for wrapping the live site as a Trusted Web Activity
      // (TWA) for Google Play. Bubblewrap reads this manifest from the production URL
      // (https://floodedarea.com/manifest.webmanifest). See PLAYSTORE_PACKAGE.md.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'FloodedArea — Flood Watch',
          short_name: 'FloodedArea',
          description:
            'Live crowd-sourced flood map for Metro Manila & Rizal: real-time reports, ' +
            'evacuation centers, road conditions, rainfall alerts and SOS rescue.',
          id: '/',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f4f7f9',
          theme_color: '#0ea5e9',
          lang: 'en-PH',
          categories: ['weather', 'utilities', 'navigation'],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Precache the built app shell. The big static data files (road geometry, audio,
          // share/QR images) are fetched at runtime, not precached — keep the SW lean.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          globIgnores: ['**/roads.json', '**/og-cover.jpg', '**/gcash-qr.png', '**/alert.wav'],
          navigateFallbackDenylist: [/^\/api/, /^\/sse/],
        },
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_COMMIT__: JSON.stringify(buildCommit),
      __BUILD_TIME__: JSON.stringify(buildTime),
    },
    server: {
      port: 5176,
      open: true,
      headers: {
        // Allow the Google OAuth popup to postMessage back to this window.
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});

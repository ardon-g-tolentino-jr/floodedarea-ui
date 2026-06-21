import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react()],
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

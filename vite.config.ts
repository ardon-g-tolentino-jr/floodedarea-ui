import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the app calls `/api/*` and Vite proxies it to baha-api (default :8083).
// Point VITE_API_URL at the json-server mock (:3001) for offline UI work.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:8083';

  return {
    plugins: [react()],
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

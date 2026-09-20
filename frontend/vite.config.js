import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend is a static build, so it cannot be asked at runtime which commit it came
// from — the answer has to be baked in. Railway sets RAILWAY_GIT_COMMIT_SHA during the
// build; Vite only forwards VITE_-prefixed vars on its own, so it is injected explicitly.
const commit = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? '';

export default defineConfig({
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit ? commit.slice(0, 7) : 'dev'),
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React changes when we upgrade it; the app changes several times a day. Sharing one
        // file meant every release invalidated the framework too, so returning players
        // re-downloaded it for nothing. Splitting them lets the big, stable half stay cached.
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/ws': { target: 'ws://localhost:4000', ws: true },
    },
  },
});

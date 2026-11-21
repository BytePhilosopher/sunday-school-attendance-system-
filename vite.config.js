import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read PORT from the root .env so the dev proxy always points at the API.
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || 3000;

  return {
    root: 'client',
    envDir: '..',
    plugins: [react()],
    build: { outDir: '../dist', emptyOutDir: true },
    server: {
      port: 5173,
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
  };
});

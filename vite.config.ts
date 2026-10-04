import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `base: './'` makes every asset URL relative, so the same build works when served from
// a domain root or from any sub-path (e.g. https://<user>.github.io/<any-repo-name>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});

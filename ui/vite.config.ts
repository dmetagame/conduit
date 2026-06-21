import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split heavy vendor groups so the initial bundle isn't one 600 kB+ chunk.
        // Match by module path — @mysten/sui is subpath-only, so bare-name entries
        // can't be resolved; bucketing by node_modules path avoids that.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@mysten')) return 'sui';
          if (id.includes('gsap') || id.includes('lenis')) return 'motion';
          if (id.includes('@tanstack')) return 'query';
        },
      },
    },
  },
});

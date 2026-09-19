import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /node_modules\/(?:react|react-dom|scheduler)\//,
              },
              {
                name: 'icons',
                test: /node_modules\/lucide-react\//,
              },
              {
                name: 'catalogue-data',
                test: /src[\\/]data[\\/](?:movies|actors)/,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR can be disabled via DISABLE_HMR when needed.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

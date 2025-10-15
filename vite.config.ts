import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Place scripts in appropriate directories
          if (chunkInfo.name === 'background') {
            return 'background/index.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content/index.js';
          }
          if (chunkInfo.name === 'options') {
            return 'options/index.js';
          }
          return '[name].js';
        },
        chunkFileNames: 'shared/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    sourcemap: process.env.NODE_ENV === 'development',
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'public/manifest.json',
          dest: '.',
        },
        {
          src: 'public/icons',
          dest: '.',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

import { defineConfig, type UserConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Multi-build configuration for MV3 extension
 * Build 1: Content script (IIFE, single-file, all deps inlined)
 * Build 2: Background service worker (ES module)
 * Build 3: Options page (standard HTML/JS)
 *
 * Use BUILD_TARGET env var to select which config to use:
 * - BUILD_TARGET=content (default)
 * - BUILD_TARGET=background
 * - BUILD_TARGET=options
 */

const buildTarget = process.env.BUILD_TARGET || 'content';

// Shared configuration
const sharedConfig = {
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: process.env.NODE_ENV === 'development',
  },
};

// Build 1: Content Script (IIFE)
const contentScriptConfig: UserConfig = {
  ...sharedConfig,
  build: {
    ...sharedConfig.build,
    outDir: 'dist',
    emptyOutDir: true, // Clean on first build
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'JobTriageContent', // Global name for IIFE
      formats: ['iife'],
      fileName: () => 'content/index.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'content/index.js',
        // Inline all dynamic imports - no chunks
        inlineDynamicImports: true,
      },
    },
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
};

// Build 2: Background Service Worker (ES Module)
const backgroundScriptConfig: UserConfig = {
  ...sharedConfig,
  build: {
    ...sharedConfig.build,
    outDir: 'dist',
    emptyOutDir: false, // Preserve content script from first build
    lib: {
      entry: resolve(__dirname, 'src/background/index.ts'),
      formats: ['es'],
      fileName: () => 'background/index.js',
    },
    rollupOptions: {
      external: [], // Bundle all dependencies (don't externalize)
      output: {
        entryFileNames: 'background/index.js',
        inlineDynamicImports: true, // Inline all imports into single file
      },
    },
  },
};

// Build 3: Options Page (HTML + JS)
const optionsPageConfig: UserConfig = {
  ...sharedConfig,
  build: {
    ...sharedConfig.build,
    outDir: 'dist',
    emptyOutDir: false, // Preserve previous builds
    rollupOptions: {
      input: resolve(__dirname, 'src/options/index.html'),
      output: {
        entryFileNames: 'options/index.js',
        assetFileNames: (assetInfo) => {
          // Move HTML to options directory root
          if (assetInfo.name?.endsWith('.html')) {
            return 'options/index.html';
          }
          return 'options/assets/[name][extname]';
        },
      },
    },
  },
};

// Export config based on BUILD_TARGET
export default defineConfig(
  buildTarget === 'background'
    ? backgroundScriptConfig
    : buildTarget === 'options'
    ? optionsPageConfig
    : contentScriptConfig
);

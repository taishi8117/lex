import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vite configuration for Safari iOS extension.
 * Builds web extension code to ios/Lex/Lex Extension/Resources/
 */
export default defineConfig({
  plugins: [react()],

  // Use relative paths for extension compatibility
  base: './',

  // Use Safari-specific public directory
  publicDir: 'src-safari/public',

  define: {
    // Platform detection for storage adapter
    __PLATFORM__: JSON.stringify('safari'),
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@safari': resolve(__dirname, 'src-safari'),
    },
  },

  build: {
    outDir: 'ios/Lex/Lex Extension/Resources',
    emptyOutDir: true, // Clear and rebuild with correct manifest

    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src-safari/content/index.tsx'),
        background: resolve(__dirname, 'src-safari/background/safari-background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },

    // Safari 15.4+ supports ES2020
    target: 'safari15',

    // Generate sourcemaps for debugging
    sourcemap: true,
  },

  // CSS configuration
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
});

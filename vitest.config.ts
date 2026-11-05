import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    // netlify dev copies functions (and their tests) into .netlify.
    exclude: [...configDefaults.exclude, '.netlify/**'],
  },
  resolve: {
    alias: {
      'astro:middleware': path.resolve(__dirname, 'src/__mocks__/astro-middleware.ts'),
      'astro:actions': path.resolve(__dirname, 'src/__mocks__/astro-actions.ts'),
      'astro:content': path.resolve(__dirname, 'src/__mocks__/astro-content.ts'),
    },
  },
});
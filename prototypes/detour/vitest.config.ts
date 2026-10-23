import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    reporters: ['default', 'json'],
    outputFile: {
      json: fileURLToPath(
        new URL('../../artifacts/product-discovery/prototype/unit-results.json', import.meta.url),
      ),
    },
    restoreMocks: true,
  },
});

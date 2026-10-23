import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    reporters: ['default', 'json'],
    outputFile: {
      json: fileURLToPath(new URL('../../artifacts/adhd-first/unit-results.json', import.meta.url)),
    },
  },
});

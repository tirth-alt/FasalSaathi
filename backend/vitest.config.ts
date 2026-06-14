import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Mirror the tsconfig `@/*` -> `src/*` path alias so test imports resolve.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Allow tests to run without a live Supabase DB.
    // RLS integration tests self-guard based on SUPABASE_DB_URL env var.
  },
});

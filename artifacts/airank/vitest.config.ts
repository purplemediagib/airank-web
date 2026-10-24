import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{jsx,tsx}', 'src/lib/measurement-status.test.ts', 'src/lib/daily-tracking.test.ts', 'src/lib/traffic-report.test.ts'],
    setupFiles: ['./test/setup.ts'],
    env: { TZ: 'UTC' },
    restoreMocks: true,
  },
});

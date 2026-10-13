import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/{unit,contract,integration,performance}/**/*.test.ts'], setupFiles: ['tests/setup.ts'], testTimeout: 30000, fileParallelism: false },
});

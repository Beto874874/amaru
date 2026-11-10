import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Las pruebas de integracion comparten una unica base de datos: no se
    // ejecutan archivos en paralelo para que la limpieza entre archivos no
    // se pise.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/docs/**', 'src/db/schema/**'],
    },
  },
});

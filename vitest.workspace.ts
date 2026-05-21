import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const alias = { '@': path.resolve(__dirname, './src') };
const sharedPlugins = [react()];
const sharedResolve = { alias };
const sharedSetup = { globals: true, setupFiles: ['./tests/helpers/setup.ts'] };

export default defineWorkspace([
  {
    plugins: sharedPlugins,
    resolve: sharedResolve,
    test: {
      ...sharedSetup,
      name: 'unit',
      include: ['tests/unit/**/*.spec.ts'],
      exclude: ['**/node_modules/**'],
      environment: 'node',
    },
  },
  {
    plugins: sharedPlugins,
    resolve: sharedResolve,
    test: {
      ...sharedSetup,
      name: 'component',
      include: ['tests/component/**/*.spec.{ts,tsx}'],
      exclude: ['**/node_modules/**'],
      environment: 'jsdom',
    },
  },
  {
    plugins: sharedPlugins,
    resolve: sharedResolve,
    test: {
      ...sharedSetup,
      setupFiles: ['./tests/helpers/setup.ts', './tests/helpers/integration-setup.ts'],
      globalSetup: ['./tests/helpers/global-setup.ts'],
      name: 'integration',
      include: ['tests/integration/**/*.spec.ts'],
      exclude: ['**/node_modules/**'],
      environment: 'node',
      testTimeout: 60_000,
      hookTimeout: 120_000,
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
    },
  },
]);

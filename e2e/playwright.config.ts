import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // globalSetup limpia la cuenta residual antes de correr; globalTeardown es el "catch" que
  // elimina la cuenta y TODA su data al terminar, aunque falle algún test. Siempre corren.
  globalSetup: './scripts/global-setup.ts',
  globalTeardown: './scripts/global-teardown.ts',
  use: {
    baseURL: process.env.FRONTEND_URL ?? 'https://milibrosorpresa.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'es-MX',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

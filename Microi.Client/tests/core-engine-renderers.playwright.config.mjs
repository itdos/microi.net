import { defineConfig } from '@playwright/test'

const browserChannel = process.env.MICROI_CORE_E2E_BROWSER_CHANNEL
  || (process.platform === 'win32' ? 'msedge' : undefined)

export default defineConfig({
  testDir: '.',
  testMatch: 'core-engine-renderers.e2e.spec.mjs',
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    ...(browserChannel ? { channel: browserChannel } : {}),
    headless: true,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--disable-gpu'],
    },
  },
  webServer: process.env.MICROI_CORE_E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 41739 --strictPort',
    url: 'http://127.0.0.1:41739/tests/harness/core-engine-renderers.html',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})

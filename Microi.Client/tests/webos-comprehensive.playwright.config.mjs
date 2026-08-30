import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    testMatch: /webos-(?:(?:comprehensive|four-issues)\.e2e|current-fixes\.visual)\.spec\.mjs/,
    timeout: 360_000,
    expect: { timeout: 20_000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        channel: 'msedge',
        ignoreHTTPSErrors: true,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
});

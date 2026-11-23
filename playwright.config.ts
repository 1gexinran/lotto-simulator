import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: {
      ...devices['Desktop Chrome'], channel: 'chromium',
      launchOptions: { executablePath: process.env.LOTTO_CHROMIUM_EXECUTABLE },
    }, testIgnore: '**/*.touch.spec.ts' },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: '**/*.touch.spec.ts' },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: '**/*.touch.spec.ts' },
    { name: 'touch', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'chromium' }, testMatch: '**/*.touch.spec.ts' },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
  },
})

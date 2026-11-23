# Live Lotto Simulator

Choose Powerball or Mega Millions, mark up to five plays, and print a simulated Texas lottery ticket. Start a six-ball draw on demand and check every play on the same ticket. The browser saves the current round locally.

## Run locally

Run these commands from the repository root with Node.js 22.12 or later and npm.

```sh
npm ci
npm run dev
```

For a production preview, run `npm run build` followed by `npm run preview`. Open the loopback URL printed by Vite. The static build is in `dist/`.

## Verify

```sh
npx playwright install chromium firefox webkit
npm run typecheck
npm test
npm run test:e2e
```

The browser suite builds and serves the production output. If you use a custom browser cache, set `PLAYWRIGHT_BROWSERS_PATH` in your shell for both browser installation and test runs. [Playwright browser setup](https://playwright.dev/docs/browsers#managing-browser-binaries)

To run the Chromium checks with a specific executable, set `LOTTO_CHROMIUM_EXECUTABLE` in your shell.

[Product requirements](docs/simulator-plan.md) · [Implementation handoff](docs/simulator-implementation.md) · [Texas rules edition](docs/references/us-lottery-rules.md) · [Release checks](docs/release-checks.md)

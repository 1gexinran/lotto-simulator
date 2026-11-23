# Live Lotto Simulator v1 release checks

Verified November 22, 2026 with Node 24.22.3 and npm 11.19.1.

| Check | Result |
|---|---|
| TypeScript and production build | Passed |
| Rules and IndexedDB unit tests | 145 passed |
| Production browser suite | 39 passed across Chrome for Testing 158.0.8127.36, Playwright Firefox 159.0, Playwright WebKit 27.2 and a Chromium iPhone 13 touch profile. The viewport matrix and CPU test ran once on Chromium. |
| Stable Firefox 160.0.1 | Both games completed from choice through Play again using the production sampler. |
| Viewports | 320×568, 390×844, 768×1024 and 1280×800 passed the no-horizontal-scroll and six-ball checks. At 390×844, the tube and the first issued line stayed in view when drawing began. |
| Keyboard and motion | The desktop keyboard flow passed with CSS transitions and animations disabled. Reduced motion produced the same stored results as skip and reload. |
| Selection feedback | 38.6, 40.5, 41.9, 41.6, 44.5, 43.2, 44.4, 41.8, 42.8 and 44.6 ms in Chrome with 4× CPU slowdown. Measured from click to the animation frame after the marked state painted. All ten met the 100 ms target. |
| Initial JavaScript and CSS | 83.37 KiB total gzip compressed, against the 250 KiB target. |
| Offline operation | The production Mega Millions flow completed after the browser went offline. All observed requests were local assets. |

Reviewed screenshots at confirmation, after issue, after the fifth ball and at completed results. Reduced-motion screenshots cover confirmation, issue and the immediate result. The fifth-ball checkpoint is only applicable to ordinary playback. The browser runner saves the screenshots under `test-results/`.

The tests compare the printed ticket and all six balls across duplicate confirmation, simultaneous starts, failed writes, retry, skipped motion and reload. Deterministic fixtures cover no award, multiple fixed awards, jackpot shares and independent Mega Millions multipliers. The production smoke flows use Web Crypto.

No v1 acceptance target was missed. The touch run uses browser emulation. A browser database upgrade that remains blocked by another connection is deferred to future schema migration work. The current release uses database version 1.

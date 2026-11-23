# Live Lotto Simulator · technical design and delivery plan

**November 22, 2026 · v1 engineering handoff.** Implement the [product requirements](simulator-plan.md). Use the [approved playslip demo](demos/choose-a-game.html) as a behavioral and visual fixture and the [verified rules](references/us-lottery-rules.md) for prices, weights and awards. The project currently contains design materials and a browser demo. The following paths, APIs and test commands describe the application to build.

## Architecture and project setup

Build a static React + TypeScript app with Vite. Use ordinary HTML for numbers and ticket rows, CSS transforms/keyframes for paper and ball movement, and IndexedDB for the current round. The tube needs six animated elements, a rail and an end stop. CSS gradients and a highlight along the tube provide depth. Bundle artwork and fonts locally. The simulation runs entirely in the browser after the page loads.

| Owner | Responsibility |
|---|---|
| Game rules, in `src/game/` | Versioned game definitions, line validation, pricing, unbiased number selection, issue-time assignment, draw creation and pure scoring. |
| Round management, in `src/round/` | User commands, guarded transitions, typed stored records, atomic writes and recovery. Supplies read-only view models to components. |
| Views, in `src/ui/` | Chooser, playslip, review, ticket face, draw tube and results. Reuse the ticket face across issue, draw and results. Preserve the prototype’s layout, controls and ink treatment. |

Use Node LTS and npm. Install dependencies from the committed lockfile with `npm ci`. Install the Playwright browsers before running the browser suite. Keep any custom toolchain, npm cache, temporary directory or browser cache settings in the local shell environment.

## Round records and interfaces

Use integer USD cents. Preserve board letters independently of array positions in filtered reviews. Use the integer values 1–70 internally and apply two-digit formatting only for display.

| Record | Required fields and invariants |
|---|---|
| Round | Unique round ID, revision, schema version, rules edition, phase, selected game, game-specific drafts and active board position. One active round per browser origin. |
| Game draft | A–E board slots, explicit selections per pool, a Quick Pick flag per pool, optional Power Play election for Powerball, and cash/annuity election. Both games begin with board A, no selections and no payment election. |
| Scenario | Jurisdiction TX, game, one simulated draw ID and simulated draw timestamp, initially advertised annuity estimate in cents. Fix the scenario to the dated rules edition described in the rules reference. Use $100 million as the fixture estimate. At review creation, assign the next scheduled national draw timestamp strictly after the creation instant, using America/New_York with daylight saving. Label the round simulated and permit immediate on-demand playback. Keep its date and ID across edits to that game’s review. |
| Issued ticket | Ticket ID, round ID, scenario snapshot, issue instant, rules edition, elections, total cost and ordered A–E lines actually purchased. Each line contains its letter, sorted white values, special value, origin of each pool and, for Mega Millions, its purchase-time multiplier. |
| Draw | Game, rules edition, matching draw ID, five distinct white values in extraction order, separate special value, Power Play multiplier for Powerball. Save the entire outcome before reveal. |
| Result | Per board letter, matched white values, special match, tier, applied multiplier or set-award exception, fixed award in cents or jackpot share marker. Include fixed-award total and number of jackpot-winning plays. Derive it from the ticket, draw and stored rules edition. |

Use these domain entry points. Supply an injectable unbiased integer sampler for deterministic tests. In production draw uniformly in [0, limit) with Web Crypto and rejection sampling. Sample white numbers without replacement from the defined game pool, and sample the special number independently. Use exact integer weight tables from the rules reference.

- `classifyLine(draftLine, rules)` returns blank, partial or complete. A pool is resolved by the required manual count or a Quick Pick flag. A line is blank when both pools are empty and both flags are off.
- `quote(draft, rules)` returns the included letters, per-line price, total cents and field errors. Include complete lines, omit blanks, and block purchase if any line is partial or the payment election is missing. Finish can enter review before the election is supplied. Confirm requires all errors resolved.
- `issueTicket(draft, scenario, rules, rng)` validates the quote, resolves only QP pools and samples a Mega Millions multiplier independently per line. Preserve manually selected values. Assign one immutable ticket.
- `createDraw(scenario, rules, rng)` samples the outcome independently of the ticket. Use the initial annuity estimate to select the correct Power Play weight table. The tube renders the extraction order exactly as stored.
- `scoreTicket(ticket, draw, rules)` requires matching game, draw ID and rule edition, and returns all per-line decisions in ticket order. This calculation is independent of animation progress.

## State transitions and recovery

| From | Action | Stored change and next visible state |
|---|---|---|
| Choose / edit | Choose game, mark, clear, switch board or return to chooser | Save the draft and current board. Keep drafts separate if the player switches games. |
| Edit | Finish | Require at least one complete play and zero partial plays. Create or reuse that game’s scenario and show Review. |
| Review | Edit / Confirm & print | Edit returns to the saved board. Valid confirmation commits one issued ticket, then starts the paper effect. The steady state is Issued. |
| Issued | Start draw | Atomically create the draw and enter Revealing. Begin animation after the transaction succeeds. |
| Revealing | Sixth ball settles / Skip / reduced motion | Mark the round Complete once, settle all six balls and display results on the same ticket. |
| Complete | Play again | Start a new round ID at the chooser. Clear the prior round only as part of that successful transition. |

Use a single read/write IndexedDB transaction for each mutation. Read the current round and expected revision inside the transaction. Duplicate Confirm and Start commands for the same round return the already stored ticket or draw. For stale draft edits, reload the newest revision before accepting another edit. A stale command for a replaced round must never affect its successor. Cross-tab messages can prompt a reread. The persisted record decides which transition wins.

On reload restore Choose, Edit, Review, Issued and Complete as stored. A reload in Revealing completes the saved draw for the round, like Skip. When any tab observes Complete, render all six settled balls and the results together in one update. Another open tab may finish its animation early as a consequence, but a score must never appear beside a partly filled tube. A reload during the paper effect lands on the issued ticket. If a write fails, retain the last committed screen and offer Retry with an explanation. If storage is unavailable at startup, explain that saving is unavailable and offer retry. If a stored schema or rules edition cannot be decoded, offer an explicit fresh round and retain the old record until the player chooses it.

## Interaction contracts

**Playslip.** Next play and the exposed right edge share one completion guard. Revisit an existing right-hand board before allocating a new one. Moving left preserves incomplete marks. Preserve the muted completed board, mobile saved-line summary, and original A–E labels when blank boards are omitted. Toggling QP on replaces the corresponding manual pool with a pending QP mark. Toggling it off leaves that pool empty. A manual tap on a QP pool switches it to manual and records that tap. Whole-line QP selects both fields. Clear affects only the current board. Review labels unissued QP selections explicitly.

**Confirmation.** Disable duplicate activation while a write is pending. Mount the issued ticket at its final size underneath a clipping mask. Translate it vertically from the slot, then remove the mask when the feed finishes. The printed component takes an issued ticket and optional results. It must never generate identifiers, numbers or multipliers during rendering. Keep focus on the ticket heading once issued, with Start draw next in keyboard order.

**Tube and timing.** Treat the leftmost center as slot 0 and the rightmost as slot 5. Derive six equal slots from the rail’s usable width, leaving half a ball diameter at either end. Use diameter up to 90% of a slot, capped at 64 CSS pixels, so all six fit on a phone. Tilt the rail upward to the right and counter-rotate the final numeral faces until upright. Spawn each ball fully offscreen to the right inside the clipped rail. Animate to its own slot with ease-out and modest rotation. Earlier balls stay settled.

Start ball 1 immediately. Allocate about 650 ms for each roll and 350 ms of rest before the next entry. The sixth ball settles about 5.65 seconds after the first begins. Use a single monotonic timeline starting at the committed draw. Derive revealed count and position from elapsed time so background-tab throttling and a resize cannot reorder or duplicate balls. When the tab becomes visible again, reconcile elapsed time. Guard completion by round ID and phase, and cancel pending playback on skip, unmount or completion. Animation-end events may decorate the scene but cannot decide winnings or strand the player.

**Ticket and results.** Keep the original line numbers and any purchased multipliers readable throughout the roll. Expose only settled numbers in the draw status. Withhold score annotations, prize totals and their accessibility text until Complete. Display the Power Play draw value separately from the six balls. After completion, use the stored result inputs to annotate the existing ticket and render Play again. If winnings include a jackpot, report fixed awards and jackpot shares separately. Keep the simulated annuity estimate distinct from cash and from the fixed-award total.

## Non-functional requirements and acceptance targets

These are v1 engineering defaults. The user can revise device coverage or budgets independently of the game flow.

| Area | Acceptance target |
|---|---|
| Responsive layout | Check 320×568, 390×844, 768×1024 and 1280×800. No page-level horizontal scroll. The tube shows six readable numbers at all widths. At 390×844, the tube, ticket heading and first line are visible together when the draw starts. Five-line tickets can scroll vertically. |
| Input and accessibility | All functions work by pointer, touch and keyboard. Provide visible focus, labeled number toggles, a keyboard alternative to the exposed edges, and meaningful screen-reader names for white and special balls. Each distinct number target is at least 24×24 CSS pixels. Use text and shape for selections and winnings. Honor reduced motion for zoom, board slide, print and draw. Skip remains available throughout ordinary playback. |
| Performance | Target ≤250 KiB compressed initial production JS + CSS. On desktop Chromium with 4× CPU slowdown, measure ten taps after load, targeting ≤100 ms to visible selection feedback for at least nine. Animate transforms and opacity without rerendering the playslip on every frame. Test a six-ball reveal at phone width without clipping or skipped numbers. |
| Compatibility | Test the production build in current stable Chromium, WebKit and Firefox. Run at least one narrow touch profile and one keyboard-only desktop flow. CSS motion unavailable or disabled must still produce a full readable result. |
| Privacy and operation | No account, payment, analytics or personal data collection. Bundle all critical assets. No external network requests are needed after the initial static assets load. Retain only the current round locally. Reload recovery assumes browser storage is available. |
| Delivery environment | No extra plugin or 3D engine is required. The deliverable is a locally runnable production build. Public hosting, traffic capacity and availability targets require a deployment brief if requested later. |

## Implementation order and verification

Provide npm scripts for `dev`, `typecheck`, `test`, `test:e2e`, `build` and `preview`. Unit tests use a deterministic sampler. Browser tests use deterministic round fixtures for rare wins and actual production sampling for a normal full-flow smoke test.

1. **Rules and price engine.** Set up Node, TypeScript and the unit runner. Implement versioned Texas rules and all five domain entry points. Test all twelve match combinations for both games and every allowed multiplier. Enumerate all 43/42/32 weight slots, the $150 million boundary, duplicate whites, cross-pool equality, mixed QP/manual lines and nonconsecutive board letters. Run the [rules-reference acceptance cases](references/us-lottery-rules.md). For case 7 exercise v1’s unknown-share path, including duplicate jackpot lines and mixed fixed awards. The numerical pool-division example is for a future scenario with a known cash pool and winner count.
2. **Round storage and board UI.** Implement the transactional round store and port the approved chooser and playslip. Wire manual and QP input, A–E navigation, Clear, Finish, payment election and Power Play. Test partial drafts through back/forward navigation and reload. Check that an empty middle board does not renumber the review or change the price of other plays.
3. **Review, issue and print.** Render review from the quote and print from the committed ticket. Test two simultaneous confirms, a failed write, reload during print, five-line mobile layout, and distinct Mega Millions multipliers on identical line selections. Expected outcome is one ID and one set of resolved values.
4. **Draw and ticket checking.** Implement the tube, reveal controller, stable ticket and results. Inject whites [42, 7, 61, 12, 3] plus special 7. Verify that exact left-to-right order, white/white/white/white/white/red coloring and the game-specific sixth label. Assert no results at ball five, exactly one result at ball six, and identical results on skip, reload, reduced motion and simultaneous starts. Reload a second tab midway through reveal and verify every tab that shows results has all six balls settled. Include a no-win, multiple line wins and a jackpot-share case.
5. **Release acceptance.** Run typecheck, unit tests, browser tests and the production build. Serve the production output and complete both games from choice through Play again. Record browser/viewport, bundle sizes, touch feedback measurements and any unmet target. Review normal and reduced-motion recordings or screenshots at confirmation, ticket issue, the fifth ball and completed results.

**Definition of done.** The approved board interactions pass regression checks, each ticket and draw is created once, all six visible balls agree with the saved outcome, every line can be reconciled to the rules reference, and the ticket stays visible from issue through results. Complete the checks against the production build before calling the application ready.

# Live Lotto Simulator · v1 product requirements

**Implementation handoff · November 22, 2026.** A player chooses a U.S. lottery, marks one to five plays, confirms one simulated purchase, watches an on-demand six-ball drawing, and sees exactly what each play won. All prices and prizes are simulated. A successful first visit can include the whole experience.

**Design decisions.** The [clickable demo](demos/choose-a-game.html) is the visual reference for game selection, marks, board layout and navigation. Its Finish screen is the handoff to the production review and ticket flow. The draw uses a single tilted tube. Five white balls enter first, followed by one red ball labeled for the game. The player's issued ticket stays on screen during the reveal and becomes the checked ticket when the sixth ball settles.

**Build defaults.** Use Texas as the v1 retail profile, a single drawing per ticket, and an explicitly labeled $100 million simulated annuity estimate for both games. The estimate is a round input, independently configurable per game. Quotes of fixed prizes assume an ordinarily funded draw. Show a jackpot-winning play as a share of the simulated jackpot, with the estimate labeled separately. Sales, real payouts, accounts and a live jackpot feed are outside this release. [U.S. game rules and state exceptions](references/us-lottery-rules.md)

**For implementers.** Use the [low-level design, test matrix and delivery plan](simulator-implementation.md) together with this document. The numerical rules have one source in the project. Presentation details such as the red Mega Ball in the tube belong to the view.

## 1. Choose a playslip

**Approved November 22, 2026.** A zoomed-out playslip fills the background behind two game choices. Each choice names the game and its price per play. Selecting one fades the choices, brings the same sheet closer, and settles the view on an interactive first board with the selected game's number ranges. Both choices fit on the opening phone screen. [Open the interactive design study](demos/choose-a-game.html).

The approved demo sets the zoom distance and final board framing. The neutral sheet takes on the chosen game's colors. The Texas retail profile supplies the purchase options for v1.

## 2. Fill in the playslip

**Marking behavior confirmed November 22.** Keep the original demo’s ink-filled oval. Click or tap a number to mark it and tap it again to remove the mark. **Clear play** removes all marks from the current board and preserves earlier plays.

**Completing a play.** Once the player has picked five white numbers and one special ball, offer **Next play** and **Finish**. Next play slides the continuous playslip left by one board. The completed board retains its ink marks and dims while the blank board moves into the active position. On narrow screens, a compact summary above the new grid keeps the previous selection readable. With reduced motion enabled, the board changes immediately. Finish shows the completed lines for review before purchase. Board E is the last available play. An unused trailing board can be skipped by finishing. A partially filled board must be completed or cleared. [Try the updated demo](demos/choose-a-game.html).

**Board navigation.** Clicking the visible left-hand slip reopens the previous board for editing. Clicking the right-hand slip follows the same completion rule as **Next play**. Reopening a board restores its selections, including unfinished marks. When advancing again, return to the existing next board if one is already on the slip. Finish checks all started boards and lists completed plays once under their original letters.

Label boards A–E. Show one active board on a narrow screen, with a summary of completed lines. Each board has a white-number field and a separate special-ball field. Keyboard users can navigate the numbers and toggle the same marks. Offer Quick Pick for a whole line and the pool-specific QP boxes supported by the selected state's slip. Generate terminal selections at issue time for a faithful paper QP experience. Preserve hand-picked numbers in the other pool.

Show the running price, identify the exact incomplete field, and let the player clear a board. A blank board adds nothing. Apply Power Play to every active line on that ticket. Require the Texas jackpot payment election before purchase. Verify one hand-picked line and one Quick Pick together on a phone.

## 3. Confirm plays and issue the ticket

**Review.** Finish groups the lines under their original A–E labels. List all selected numbers or pending Quick Picks, the game, Power Play election where applicable, Texas jackpot payment election, play count and total simulated cost. For example, three Powerball lines with Power Play cost $9. Back to playslip restores the current board. **Confirm & print** issues the ticket once and locks the selections, cost, options and assigned numbers.

**Paper transition.** Keep the paper palette, ink color and type treatment of the accepted demo. On confirmation, the review sheet draws upward about 24 pixels and fades over 180 ms. In its place, a narrow horizontal slot reveals a cream thermal ticket, feeding top edge first over roughly 550 ms. End with all rows rendered as readable, selectable text and the ticket in its draw-screen position. Reserve the final ticket footprint so the layout stays steady. Reduced motion shows the issued ticket immediately. An issue failure leaves the editable review visible.

**Ticket face.** Show game, Texas, simulation ticket ID, simulated draw ID, issue and simulated draw dates, play letters, five sorted white numbers, separately labeled special ball, purchase elections and total. Mark resolved Quick Pick fields. Mega Millions prints the assigned multiplier beside each play. Powerball prints its ticket-wide Power Play election. Finish with “Simulation ticket”. **Start draw** appears with the issued ticket and waits for the player. [Official Mega Millions ticket example](https://www.megamillions.com/How-to-Play.aspx)

## 4. Watch the six-ball draw

**Layout.** Draw a shallow transparent tube, a dark surround, a lower retaining rail and an end stop on the left. Tilt the tube about 3 degrees, with the right entrance slightly higher than the left stop. Numbered balls roll in from the right. Keep the camera fixed and the settled numbers legible.

**Choreography.** The first ball travels to the far-left slot. Each later ball travels a shorter distance and settles immediately to the right of the preceding one. Show five white balls sequentially in draw order. The sixth ball is red in both games and carries the text label **Powerball** or **Mega Ball** beside the tube. The official U.S. Mega Ball is gold. Red is the confirmed simulator presentation choice and has no effect on the number pool, multiplier or prizes. Show the draw's Power Play value as text for Powerball. Mega Millions multipliers remain on the printed rows.

**Keep the ticket in view.** At desktop widths the tube and ticket share the stage, with the ticket to the right. On phones place the tube above the ticket, with its header and first play visible together at a typical phone height. Allow ordinary page scrolling for long tickets. Starting or finishing a draw keeps the same ticket on screen. **Skip to results** settles all six and follows the same completion path. Reduced motion shows a static result without requiring playback.

## 5. Read the result on the ticket

When the last ball settles, reveal the results automatically on the existing screen. Keep the six numbers visible in the tube. Add an ink ring to each matching ticket number and a text description on each row, including “0 white + no special ball” for a losing line. Score the white and special pools separately even when the same numeral appears in both.

Show the base prize, multiplier if applicable, and line award. For example, a Mega Millions line with one white match, the Mega Ball and a printed 3× pays $7 × 3 = $21. Power Play with five whites only pays the set $2 million. Total the fixed awards once. A jackpot result gives the number of winning plays and identifies the estimated annuity and the payment election. Keep the final cash share unquoted for this scenario. **Play again** starts a fresh visit to the game chooser.

## Acceptance and operating assumptions

- A player can complete either game on a phone, with a mouse or using only the keyboard. Saved board letters, selections and print-time values survive navigation and refresh.
- From confirmation through result checking there is one ticket ID and one draw ID. Double taps, multiple tabs, skipped motion and a refresh during playback must reproduce the same issued ticket and result.
- A player can see that five white balls arrived before the red ball, identify which play won and reconstruct its prize from the ticket. Playback must never expose the final result early in the visible UI or accessibility tree.
- Ship a static client with a self-contained tube animation and browser-local round storage. No additional plugin is needed. The technical handoff specifies measurable quality targets, recovery behavior and test coverage. [Implementation handoff](simulator-implementation.md)

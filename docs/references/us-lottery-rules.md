# U.S. Powerball and Mega Millions rules reference

**Verified November 21, 2026.** Use this edition for contemporary U.S. retail plays. Amounts are U.S. dollars, per play, per drawing. The prize table below covers ordinary funded draws in jurisdictions that use the published set prizes. The jurisdiction section records the limits of that assumption. The simulator design is in the [product requirements](../simulator-plan.md).

## 1. Buy a play

| Rule | U.S. Powerball | U.S. Mega Millions |
|---|---|---|
| White numbers | 5 distinct integers, 1–69 inclusive | 5 distinct integers, 1–70 inclusive |
| Separate special number | 1 red Powerball, 1–26 inclusive | 1 gold Mega Ball, 1–24 inclusive |
| Basic price | $2 | $5, including the multiplier |
| Terminal choice | Manual selection or Quick Pick | Manual selection or Quick Pick, also called Easy Pick |
| Multiplier attached to | The drawing. A purchased Power Play election makes the ticket eligible. | Each purchased play. The terminal assigns it and prints it on that line. |
| National drawing time | Mon, Wed, Sat at 10:59 p.m. Eastern, Tallahassee, Florida | Tue, Fri at 11:00 p.m. Eastern, Atlanta, Georgia |
| Jackpot odds per play | 1 in 292,201,338 | 1 in 290,472,336 |

The two number pools are independent. For example, a white 12 and a special 12 can appear on the same line or in the same drawing. White numbers match in any order. Multiple lines may use the same selections. Generate a Quick Pick with the same distribution as a random draw. Match each purchased line individually. [Powerball U.S. game](https://www.powerball.com/) · [Powerball prize chart](https://www.powerball.com/powerball-prize-chart) · [Mega Millions game and prizes](https://www.megamillions.com/How-to-Play.aspx) · [Mega Millions draw schedule](https://www.megamillions.com/FAQs.aspx)

The current Mega Millions matrix first applied to the April 8, 2025 drawing. Older slips with a 25th Mega Ball, a $2 price, an optional Megaplier or Just the Jackpot belong to a retired edition. Powerball also has a UK retail version with a different price and lower-tier payouts. Use the U.S. data throughout this project. [Mega Millions edition change](https://www.megamillions.com/FAQs.aspx) · [Powerball U.S. and UK distinctions](https://www.powerball.com/faqs/)

## 2. Price the ticket and assign multipliers

**Powerball.** Under the standard optional Power Play model, a ticket with N plays costs N × $2, or N × $3 when Power Play is marked. The ticket records that election at purchase. Select a single multiplier just before the drawing and associate it with the draw, including when the player's own ticket has no Power Play. Every eligible play for that draw uses the same value. [Powerball purchase rules](https://www.powerball.com/) · [Florida Lottery draw procedure](https://floridalottery.com/help/faqs/draw-games-faq)

**Mega Millions.** A ticket with N plays costs N × $5. Select a multiplier per play at issue time. Each line uses the full distribution again, so multiplier values can repeat on the same ticket. Store the assigned value alongside its numbers. Printing, refreshing or rechecking an existing ticket must preserve the original assignments. [Mega Millions how to play](https://www.megamillions.com/How-to-Play.aspx) · [Washington's published Mega Millions rule, WAC 315-38-080](https://app.leg.wa.gov/WAc/default.aspx?cite=315-38&full=true)

| Exact sampling weight | 2× | 3× | 4× | 5× | 10× | Total |
|---|---:|---:|---:|---:|---:|---:|
| Power Play, initially advertised **annuity** jackpot ≤ $150,000,000 | 24 | 13 | 3 | 2 | 1 | 43 |
| Power Play, initially advertised **annuity** jackpot > $150,000,000 | 24 | 13 | 3 | 2 | 0 | 42 |
| Mega Millions, every play at purchase | 15 | 10 | 4 | 2 | 1 | 32 |

Choose a uniformly distributed integer from 1 through the row total and map it to the cumulative weights from left to right. Exactly $150 million includes 10×. Capture the initial advertised annuity estimate for that draw before sampling. The cash estimate, an updated estimate and an individual winner's share do not determine 10× eligibility. [Powerball multiplier frequencies](https://www.powerball.com/powerball-prize-chart) · [Texas Powerball initial jackpot condition](https://www.texaslottery.com/export/sites/lottery/Games/Powerball/index.html) · [Texas Mega Millions exact frequencies](https://www.texaslottery.com/export/sites/lottery/Games/Mega_Millions/index.html)

## 3. Score the draw

Count the intersection of the two sets of white numbers (W). Compare the player's special ball only to the drawn special ball (S). Award exactly one row per play. In this table M means the applicable multiplier from the preceding section. The Mega Millions column gives the calculation, including the embedded multiplier exactly once.

| W | S | Powerball | Powerball with Power Play | Mega Millions |
|---:|:---:|---:|---:|---:|
| 5 | Yes | Jackpot share | Jackpot share | Jackpot share |
| 5 | No | $1,000,000 | $2,000,000 | $1,000,000 × M |
| 4 | Yes | $50,000 | $50,000 × M | $10,000 × M |
| 4 | No | $100 | $100 × M | $500 × M |
| 3 | Yes | $100 | $100 × M | $200 × M |
| 3 | No | $7 | $7 × M | $10 × M |
| 2 | Yes | $7 | $7 × M | $10 × M |
| 1 | Yes | $4 | $4 × M | $7 × M |
| 0 | Yes | $4 | $4 × M | $5 × M |
| 0, 1 or 2 | No | $0 | $0 | $0 |

Sum ordinary awards across all lines. The standard minimum win is $4 for base Powerball and $10 for Mega Millions. A five-white-only Mega Millions line can pay $10 million at 10×. The corresponding Power Play award stays at $2 million at every multiplier. [Powerball official prizes](https://www.powerball.com/powerball-prize-chart) · [Mega Millions official base prize matrix](https://www.megamillions.com/Media-Center/MegaMillions_New_Prize_Matrix.aspx) · [Mega Millions prizes by multiplier](https://www.megamillions.com/How-to-Play.aspx)

**Jackpots.** Matching five white balls and the special ball wins a share of the jackpot. The pool is divided among winning plays. A multiplier has no effect on it. An advertised jackpot is an estimated annuity. The cash option has a separate value. The annuity has an initial payment and 29 more annual payments, increasing by 5% each year. An unwon jackpot carries forward. Actual estimates and funding depend on the drawing. Mega Millions describes a $50 million starting jackpot under the current edition. [Powerball jackpot FAQ](https://www.powerball.com/faqs/) · [Mega Millions jackpot options](https://www.megamillions.com/How-to-Play.aspx) · [Mega Millions current edition](https://www.megamillions.com/FAQs.aspx)

**Simulator consequence.** Store a jackpot-tier result even if the final cash pool or winner count is unknown. Show the jackpot achievement and the draw's labeled estimate. Only compute a dollar share if the scenario supplies the applicable pool and total winning shares. If two lines win the jackpot, avoid adding the full advertised jackpot twice. Keep any fixed awards from other lines visible separately.

## 4. Selling jurisdiction and retail references

The national draw determines the winning numbers. The selling lottery determines the retail slip, purchase cutoff, local options and applicable payout rules. Record the selling jurisdiction on the issued ticket. Use national draw times when describing the draw and local lottery sources for sales breaks or local broadcast times. [Powerball game information](https://www.powerball.com/) · [Mega Millions FAQ](https://www.megamillions.com/FAQs.aspx)

| Jurisdiction or feature | Consequence for the build |
|---|---|
| **Texas, v1 retail profile** | Both games offer separate Quick Pick marks for the white and special pools. Either pool can be hand-picked while the other is terminal-picked. Require the Texas paper slip's cash or 30-annual-payment election at purchase and retain it on the ticket. The Power Play box applies to every completed board. |
| **Texas multi-draw** | The real slip can repeat plays for up to 15 consecutive Powerball drawings or 10 Mega Millions drawings. The proposed first release models the one-draw purchase. If the design displays the physical multi-draw area, identify the supported single-draw selection. |
| **Idaho and Montana** | Power Play is bundled into the $3 minimum Powerball play. An optional $2/$3 toggle would misprice tickets in these states. |
| **California** | Lower-tier payouts for both games depend on sales and winners. A California result requires the applicable draw's California payout data or a modeled California pool. Keep the national fixed amounts out of a California prize quote. |
| **Double Play** | Participating Powerball jurisdictions offer a second, separately scored drawing for $1 more per play, using the same selected numbers. Its top cash prize is $10 million. Power Play applies only to the main draw. Texas is absent from the official participating list as of this review. |
| **Exceptional prize funding** | The Texas brochures describe potential reductions when funds are insufficient. The standard table models an ordinarily funded draw. A historical result checker would need the actual draw's published awards. |

Sources for retail decisions: [Texas Powerball](https://www.texaslottery.com/export/sites/lottery/Games/Powerball/index.html) · [Texas Mega Millions](https://www.texaslottery.com/export/sites/lottery/Games/Mega_Millions/index.html) · [Powerball bundled pricing](https://www.powerball.com/) · [Powerball California prize note](https://www.powerball.com/powerball-prize-chart) · [Mega Millions California prize note](https://www.megamillions.com/How-to-Play.aspx) · [Double Play participating lotteries](https://www.powerball.com/double-play)

### Publisher references for design review

| Reference | What to look at | Publisher |
|---|---|---|
| Powerball retail brochure | Page 2 shows the two number fields, Power Play, payment election and boards A–E. Page 1 gives the prize chart. | [Texas Lottery original](https://www.texaslottery.com/export/sites/lottery/Documents/HTP_Powerball_ENG.pdf) |
| Mega Millions retail brochure | Page 2 explains marking the slip and payment options. Page 1 documents the embedded multiplier and prize chart. | [Texas Lottery original](https://www.texaslottery.com/export/sites/lottery/Documents/HTP_MegaMillions_ENG.pdf) |

The table links to the publisher’s PDFs. For the ticket design, consult the national game's sample and use the selected state's retail material for local fields. For broadcast examples, consult the two drawing archives. The simulator’s tube, ball colors and motion are specified in the product requirements. [Mega Millions sample ticket](https://www.megamillions.com/getattachment/How-to-Play/New-Mega-sample-ticket.png.aspx?lang=en-US) · [Powerball drawing footage](https://www.powerball.com/watch-drawing) · [Mega Millions drawing footage](https://www.megamillions.com/Winning-Numbers/Watch-Latest-Draw.aspx)

## 5. Acceptance cases for the rules engine

1. **Pool boundaries.** Powerball accepts white 69 and red 26, and rejects 70 and 27 in those fields. Mega Millions accepts white 70 and gold 24, and rejects 71 and 25. Reject zero, non-integers, repeated whites, or a completed line with any count other than five whites and one special.
2. **Cross-pool equality.** Given drawn whites 1, 2, 3, 4, 12 and special 12, the same whites in reverse order plus special 12 win the jackpot. A play with whites 5–9 and special 12 matches only the special ball. A white 12 alone cannot earn that special-ball prize.
3. **Purchase totals.** Two base Powerball lines cost $4, or $6 with Power Play. Two Mega Millions lines cost $10 regardless of assigned multipliers. Blank boards are free. In the Texas paper flow, a missing payment election requires correction.
4. **Weighted selection.** Exhaustively feed all 43, 42 and 32 integer slots through the three rows in section 2. Count each returned value and compare every count to its published weight. Test the exact $150,000,000 threshold and the first dollar above it.
5. **All tiers.** Test every combination of W = 0 through 5 and S = yes/no. Verify base Powerball, each allowed Power Play value, and all five Mega Millions multipliers against section 3. With a 5× draw, Power Play pays $2 million for five whites only and $250,000 for four whites plus red. Without the election the latter pays $50,000.
6. **Independent line awards.** Two identical Mega Millions lines matching only the gold ball, assigned 2× and 5×, pay $10 and $25, for $35 total. Repeated multiplier values are also valid. Reopening the ticket must preserve both values.
7. **Jackpot handling.** A jackpot with Power Play 10× or Mega Millions 10× still earns one share per winning play. For v1, the final cash pool and winner count are unknown. Show the tier and estimate without asserting a final cash value. A future scenario with a known $60 million cash pool and three winning plays would award a $20 million cash share to each.
8. **Fairness and playback.** Uniformly sample five white balls without replacement and the special ball from its independent pool. Use unbiased bounded integers from browser cryptographic randomness. Generate the result without inspecting purchased numbers. The number of possible jackpot combinations is C(69,5) × 26 or C(70,5) × 24. Recheck these against the jackpot odds in section 1. One saved draw must survive replay, skip, refresh and graphics loss.

**Keeping this reference current.** Before implementing or releasing a new rules edition, recheck the national how-to pages, prize charts, and the selected state's current retail instructions. Record the effective drawing date of a change when the publisher supplies one. Preserve the rule edition and draw inputs attached to existing simulated tickets.

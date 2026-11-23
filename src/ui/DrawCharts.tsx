import { RULES, type Scenario } from '../game'
import { drawCharts } from '../game/charts'
import { awardMoney, money } from './format'

const oddsNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const odds = (total: number, outcomes: number) => `1 in ${oddsNumber.format(total / outcomes)}`
const prize = (cents: number | null) => cents === null ? 'Jackpot share' : awardMoney(cents)

function prizeRange(min: number | null, max: number | null) {
  return min === max ? prize(min) : `${prize(min)}–${prize(max)}`
}

export function DrawCharts({ scenario }: { scenario: Scenario }) {
  const rules = RULES[scenario.game]
  const { tiers, totalOutcomes, winningOutcomes } = drawCharts(scenario)
  const powerball = scenario.game === 'pb'
  const matchLabel = (whites: number, special: boolean) => {
    if (whites === 0) return `${rules.specialName} only`
    return `${whites} white${special ? ` + ${rules.specialName}` : ''}`
  }

  return <aside className="draw-charts" aria-label="Prize and odds charts">
    <details>
      <summary>Prize chart</summary>
      <p>{money(rules.cents)} per play · {powerball ? `Power Play +${money(rules.powerPlayCents)}` : 'multiplier included'}</p>
      <table aria-label={`${rules.name} prizes`}>
        <thead><tr>
          <th scope="col">Match</th>
          {powerball && <th scope="col">Base prize</th>}
          <th scope="col">{powerball ? 'Power Play' : 'Prize per play'}</th>
        </tr></thead>
        <tbody>{tiers.map(tier => <tr key={`${tier.whites}-${tier.special}`}>
          <th scope="row">{matchLabel(tier.whites, tier.special)}</th>
          {powerball && <td>{prize(tier.baseCents)}</td>}
          <td>{prizeRange(tier.minCents, tier.maxCents)}</td>
        </tr>)}</tbody>
      </table>
    </details>
    <details>
      <summary>Odds chart</summary>
      <p>Any prize · {odds(totalOutcomes, winningOutcomes)}</p>
      <table aria-label={`${rules.name} odds`}>
        <thead><tr><th scope="col">Match</th><th scope="col">Odds per play</th></tr></thead>
        <tbody>{tiers.map(tier => <tr key={`${tier.whites}-${tier.special}`}>
          <th scope="row">{matchLabel(tier.whites, tier.special)}</th>
          <td>{odds(totalOutcomes, tier.outcomes)}</td>
        </tr>)}</tbody>
      </table>
    </details>
  </aside>
}

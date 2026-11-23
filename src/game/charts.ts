import { maxPowerPlay, MULTIPLIERS, POWER_PLAY_MATCH_FIVE_CENTS, RULES, type Scenario } from './index'

function combinations(pool: number, count: number) {
  let result = 1
  for (let index = 0; index < count; index++) result = result * (pool - index) / (index + 1)
  return result
}

export function drawCharts(scenario: Scenario) {
  const { game, annuityCents } = scenario
  const rules = RULES[game]
  const maxMultiplier = game === 'pb' ? maxPowerPlay(annuityCents) : MULTIPLIERS[MULTIPLIERS.length - 1]
  const totalOutcomes = combinations(rules.whiteMax, 5) * rules.specialMax
  const tiers = rules.prizes.flatMap(([whiteOnly, withSpecial], whites) =>
    [whiteOnly, withSpecial].flatMap((baseCents, special) => {
      if (baseCents === 0) return []
      const outcomes = combinations(5, whites) * combinations(rules.whiteMax - 5, 5 - whites) *
        (special ? 1 : rules.specialMax - 1)
      const setAward = game === 'pb' && whites === 5 && !special
      const minCents = baseCents === null ? null
        : setAward ? POWER_PLAY_MATCH_FIVE_CENTS : baseCents * MULTIPLIERS[0]
      const maxCents = baseCents === null ? null
        : setAward ? POWER_PLAY_MATCH_FIVE_CENTS : baseCents * maxMultiplier
      return [{ whites, special: Boolean(special), baseCents, minCents, maxCents, outcomes }]
    }),
  ).reverse()
  const winningOutcomes = tiers.reduce((sum, tier) => sum + tier.outcomes, 0)
  return { tiers, totalOutcomes, winningOutcomes }
}

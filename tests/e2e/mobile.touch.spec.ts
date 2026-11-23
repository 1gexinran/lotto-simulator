import { expect, test } from '@playwright/test'

test('phone touch flow keeps both games and a manual and Quick Pick line usable', async ({ page }) => {
  await page.goto('/')
  const game = page.getByRole('button', { name: /Mega Millions.*5/ })
  await expect(game).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('button', { name: /Powerball.*2/ })).toBeInViewport({ ratio: 1 })
  await game.tap()
  await expect(page.getByRole('heading', { name: /Mega Millions Board A/ })).toBeFocused()
  for (const number of [1, 2, 3, 4, 70]) {
    const mark = page.getByRole('button', { name: `White number ${number}`, exact: true })
    expect((await mark.boundingBox())!.width).toBeGreaterThanOrEqual(24)
    await mark.tap()
  }
  await page.getByRole('button', { name: 'Mega Ball 24', exact: true }).tap()
  await page.getByRole('button', { name: 'Next play', exact: true }).tap()
  await expect(page.getByText(/A saved · 01 02 03 04 70/)).toBeVisible()
  await page.getByRole('button', { name: 'Quick Pick whole play' }).tap()
  await page.getByRole('button', { name: 'Finish', exact: true }).tap()
  await expect(page.getByText('Play B', { exact: true })).toBeVisible()
  await expect(page.getByText('$10.00', { exact: true })).toBeVisible()
})

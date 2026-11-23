import { expect, test, type Page } from '@playwright/test'
import { balls, deterministicWords, fixture, results, seed, start, ticket } from './fixtures'

test('keyboard only completes Powerball with the production sampler and CSS motion disabled', async ({ page }, info) => {
  await page.goto('/')
  await page.addStyleTag({ content: '*,*::before,*::after {animation:none!important;transition:none!important}' })
  await expect(page.getByRole('heading', { name: 'Choose your game.' })).toBeFocused()
  const tab = info.project.name === 'webkit' ? 'Alt+Tab' : 'Tab'
  await page.keyboard.press(tab)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /Powerball Board A/ })).toBeFocused()
  const keyboard = page.keyboard
  await keyboard.press(tab)
  for (let index = 1; index <= 5; index++) {
    const mark = page.getByRole('button', { name: `White number ${index}`, exact: true })
    await expect(mark).toBeFocused()
    await keyboard.press('Space')
    await expect(mark).toHaveAttribute('aria-pressed', 'true')
    if (index < 5) await keyboard.press('ArrowRight')
  }
  await keyboard.press(tab)
  await keyboard.press(tab)
  await expect(page.getByRole('button', { name: 'Powerball 1', exact: true })).toBeFocused()
  await keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Powerball 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await keyboard.press(tab) // pool Quick Pick
  await keyboard.press(tab) // whole-play Quick Pick
  await keyboard.press(tab) // Power Play
  await keyboard.press('Space')
  await expect(page.getByLabel(/Power Play/)).toBeChecked()
  await keyboard.press(tab) // Cash value
  await keyboard.press('Space')
  await expect(page.getByLabel('Cash value')).toBeChecked()
  await keyboard.press(tab) // Clear play
  await keyboard.press(tab) // Next play
  await keyboard.press(tab) // Finish
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeFocused()
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Review your plays' })).toBeFocused()
  for (let index = 0; index < 4; index++) await keyboard.press(tab)
  await expect(page.getByRole('button', { name: 'Confirm & print' })).toBeFocused()
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Powerball ticket' })).toBeFocused()
  await keyboard.press(tab)
  await expect(start(page)).toBeFocused()
  await keyboard.press('Enter')
  await expect(results(page)).toBeVisible({ timeout: 8500 })
  const values = await balls(page).allTextContents()
  expect(new Set(values.slice(0, 5)).size).toBe(5)
  expect(Number(values[5])).toBeGreaterThanOrEqual(1)
  expect(Number(values[5])).toBeLessThanOrEqual(26)
  await expect(page.getByRole('heading', { name: 'Powerball ticket' })).toBeFocused()
  await keyboard.press(tab)
  await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused()
  if (info.project.name === 'chromium') await page.screenshot({ path: info.outputPath('keyboard-results.png'), fullPage: true })
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Choose your game.' })).toBeVisible()
})

test('Mega Millions can play a fresh round after completing a real sampled ticket offline', async ({ page, context }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const external: string[] = []
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url())
  })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready.then(() => true))
  await context.setOffline(true)
  await page.getByRole('button', { name: /Mega Millions.*5/ }).click()
  await page.getByRole('button', { name: 'Quick Pick whole play' }).click()
  await page.getByLabel('30 annual payments').click()
  await expect(page.getByLabel('30 annual payments')).toBeChecked()
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(page.getByText(/White numbers · pending Quick Pick/)).toBeVisible()
  if (info.project.name === 'chromium') await page.screenshot({ path: info.outputPath('reduced-confirmation.png') })
  await page.getByRole('button', { name: 'Confirm & print' }).click()
  await expect(ticket(page).getByTestId('ticket-line').first()).toContainText(/Multiplier (2|3|4|5|10)×/)
  if (info.project.name === 'chromium') await page.screenshot({ path: info.outputPath('reduced-issued.png') })
  await start(page).click()
  await expect(results(page)).toBeVisible()
  await expect(balls(page)).toHaveCount(6)
  expect(external).toEqual([])
  if (info.project.name === 'chromium') await page.screenshot({ path: info.outputPath('reduced-results.png'), fullPage: true })
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your game.' })).toBeVisible()
})

async function widthCheck(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
}

test('four viewport sizes fit all settled balls with no horizontal page scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'The viewport matrix runs once on Chromium.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await deterministicWords(page, [41, 6, 58, 10, 2, 6, 42])
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1280, 800]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Mega Millions.*5/ })).toBeInViewport({ ratio: 1 })
    await widthCheck(page, width)
    if (width === 1280) await page.screenshot({ path: info.outputPath('chooser-desktop.png') })
  }
  await seed(page, fixture('pb', 'issued'))
  await start(page).click()
  await expect(balls(page)).toHaveCount(6)
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1280, 800]]) {
    await page.setViewportSize({ width, height })
    await widthCheck(page, width)
    const frame = (await page.locator('.tube-frame').boundingBox())!
    const positions = await Promise.all((await balls(page).all()).map(ball => ball.boundingBox()))
    for (const ball of positions) {
      expect(ball!.width).toBeGreaterThanOrEqual(24)
      expect(ball!.x).toBeGreaterThan(frame.x)
      expect(ball!.x + ball!.width).toBeLessThan(frame.x + frame.width)
      expect(ball!.y).toBeGreaterThan(frame.y)
      expect(ball!.y + ball!.height).toBeLessThan(frame.y + frame.height)
    }
    expect(positions.map(ball => ball!.x)).toEqual(positions.map(ball => ball!.x).sort((a, b) => a - b))
  }
})

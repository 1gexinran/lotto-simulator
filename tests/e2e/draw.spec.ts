import { expect, test } from '@playwright/test'
import { balls, deterministicWords, drawOrder, fixture, results, seed, start, ticket } from './fixtures'

const words = [41, 6, 58, 10, 2, 6, 42]
const expected = drawOrder.map(value => String(value).padStart(2, '0'))

test('phone reveal settles in extraction order and withholds results through ball five', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await deterministicWords(page, words)
  await seed(page, fixture('pb', 'issued'))
  await ticket(page).evaluate(element => { element.setAttribute('data-original-ticket', 'yes') })
  await start(page).click()
  await expect(page.getByRole('region', { name: 'Simulated draw' })).toBeInViewport({ ratio: 1 })
  await expect(ticket(page).getByTestId('ticket-line').first()).toBeInViewport()
  const controls = page.locator('.ticket-controls')
  await expect(controls.getByRole('button', { name: 'Skip to results' })).toBeInViewport({ ratio: 1 })
  await expect(balls(page)).toHaveCount(5)
  await expect(results(page)).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('fifth-ball.png') })
  await expect(results(page)).toHaveCount(1)
  await expect(controls.getByRole('button', { name: 'Draw again' })).toBeVisible()
  await expect(balls(page)).toHaveText(expected)
  expect(await balls(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-ball-color'))))
    .toEqual(['white', 'white', 'white', 'white', 'white', 'red'])
  await expect(balls(page).last()).toHaveAccessibleName('Powerball 07')
  await expect(ticket(page)).toHaveAttribute('data-original-ticket', 'yes')
  await expect(ticket(page)).toContainText('Power Play set award')
  await expect(ticket(page)).toContainText('0 white + no special ball')
  await expect(ticket(page)).toContainText('$2,500,000')
  await expect(ticket(page)).toContainText('2 jackpot-winning plays')
  await expect(ticket(page)).toContainText('$100,000,000')
  await expect(ticket(page)).toContainText('Cash value')
  await page.screenshot({ path: info.outputPath('completed.png'), fullPage: true })
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your game.' })).toBeVisible()
})

test('skip, reload and reduced motion all publish the identical stored result', async ({ browser, page }) => {
  await deterministicWords(page, words)
  await seed(page, fixture('mm', 'issued'))
  await start(page).click()
  await page.getByRole('button', { name: 'Skip to results' }).click()
  await expect(balls(page)).toHaveText(expected)
  await expect(balls(page).last()).toHaveAccessibleName('Mega Ball 07')
  const checked = await ticket(page).innerText()
  await page.reload()
  await expect(ticket(page)).toHaveText(checked, { useInnerText: true })
  for (const policy of ['reload', 'reduced'] as const) {
    const other = await browser.newPage({ reducedMotion: policy === 'reduced' ? 'reduce' : 'no-preference' })
    await deterministicWords(other, words)
    await seed(other, fixture('mm', 'issued'))
    await start(other).click()
    if (policy === 'reload') {
      await expect(other.getByRole('button', { name: 'Skip to results' })).toBeVisible()
      await other.reload()
    }
    await expect(results(other)).toBeVisible()
    await expect(balls(other)).toHaveText(expected)
    await expect(ticket(other)).toHaveText(checked, { useInnerText: true })
    await other.close()
  }
})

test('simultaneous Starts and a second-tab reload settle the same six balls everywhere', async ({ page, context }) => {
  await deterministicWords(page, words)
  await seed(page, fixture('pb', 'issued'))
  const other = await context.newPage()
  await deterministicWords(other, words)
  await other.goto('/')
  await expect(start(other)).toBeVisible()
  const firstStart = await start(page).elementHandle()
  const secondStart = await start(other).elementHandle()
  await Promise.all([
    firstStart.evaluate((button: HTMLButtonElement) => button.click()),
    secondStart.evaluate((button: HTMLButtonElement) => button.click()),
  ])
  await expect(other.getByRole('button', { name: 'Skip to results' })).toBeVisible()
  // A delayed activation of the old Start button must not activate Skip in its place.
  await secondStart.evaluate((button: HTMLButtonElement) => button.click())
  await expect(balls(page).first()).toBeVisible()
  expect(await balls(page).count()).toBeLessThan(6)
  await expect(results(page)).toHaveCount(0)
  await other.reload()
  for (const tab of [page, other]) {
    await expect(results(tab)).toBeVisible()
    await expect(balls(tab)).toHaveText(expected)
  }
  await expect(ticket(other)).toHaveText(await ticket(page).innerText(), { useInnerText: true })
})

test('skipping a moving ball clears its travel and rotation in the settled tube', async ({ page }) => {
  await deterministicWords(page, words)
  await seed(page, fixture('pb', 'issued'))
  await start(page).click()
  await expect(page.locator('[data-rolling]')).toBeAttached()
  await page.getByRole('button', { name: 'Skip to results' }).evaluate((button: HTMLButtonElement) => button.click())
  await expect(results(page)).toBeVisible()
  await expect(balls(page)).toHaveText(expected)
  await expect(page.locator('[data-rolling]')).toHaveCount(0)
  expect(await balls(page).evaluateAll(nodes =>
    nodes.every(node => !(node as HTMLElement).style.getPropertyValue('--travel')))).toBe(true)
})

test('reduced motion settles a concurrent drawing during a delayed cross-tab read', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await deterministicWords(page, words)
  await seed(page, fixture('pb', 'issued'))
  const other = await context.newPage()
  await deterministicWords(other, words)
  await other.goto('/')
  await expect(start(other)).toBeVisible()
  await expect(start(page)).toBeVisible()
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      const transaction = original.call(this, stores, mode, options)
      Object.defineProperty(transaction, 'oncomplete', {
        set(handler) {
          transaction.addEventListener('complete', event => {
            if (mode === 'readonly') document.body.dataset.readComplete = 'yes'
            setTimeout(() => handler.call(transaction, event), mode === 'readonly' ? 500 : 1200)
          })
        },
      })
      return transaction
    }
  })
  await start(other).evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('body')).toHaveAttribute('data-read-complete', 'yes')
  await start(page).evaluate((button: HTMLButtonElement) => button.click())
  await expect(results(page)).toBeVisible({ timeout: 4000 })
  await expect(balls(page)).toHaveText(expected)
})

test('Draw again resets the tube and scores a new outcome on the same ticket', async ({ page }) => {
  await deterministicWords(page, [...words, 0, 0, 0, 0, 0, 7, 0])
  await seed(page, fixture('pb', 'issued'))
  const id = await ticket(page).getByTestId('ticket-id').textContent()
  const status = page.locator('.draw-status')
  const skip = page.getByRole('button', { name: 'Skip to results' })
  await start(page).click()
  await skip.click()
  await expect(balls(page)).toHaveText(expected)
  await expect(status).toHaveText('Settled 6 of 6 · 03 · 07 · 12 · 42 · 61 · Powerball 07')
  await expect(ticket(page)).toContainText('2 jackpot-winning plays')

  await page.getByRole('button', { name: 'Draw again' }).click()
  await expect(skip).toBeVisible()
  expect(await balls(page).count()).toBeLessThan(6)
  await expect(results(page)).toHaveCount(0)
  await skip.click()
  await expect(status).toHaveText('Settled 6 of 6 · 01 · 02 · 03 · 04 · 05 · Powerball 08')
  await expect(ticket(page)).toContainText('$8')
  await expect(ticket(page)).not.toContainText('jackpot-winning')
  await expect(ticket(page).getByTestId('ticket-id')).toHaveText(id!)
  await page.reload()
  await expect(balls(page)).toHaveText(['01', '02', '03', '04', '05', '08'])
  await expect(ticket(page)).toContainText('$8')
})

test('the prize and odds tables start folded and show the selected game', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await seed(page, fixture('mm', 'issued'))
  const prizes = page.getByRole('table', { name: 'Mega Millions prizes' })
  const odds = page.getByRole('table', { name: 'Mega Millions odds' })
  await expect(prizes).toBeHidden()
  await expect(odds).toBeHidden()
  await page.getByText('Prize chart', { exact: true }).click()
  await expect(prizes).toBeVisible()
  await expect(prizes).toContainText('$2,000,000–$10,000,000')
  await expect(page.getByText('$5.00 per play · multiplier included')).toBeVisible()
  await page.getByText('Odds chart', { exact: true }).click()
  await expect(odds).toBeVisible()
  await expect(odds).toContainText('1 in 290,472,336')
  await expect(page.getByText('Any prize · 1 in 23.07')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  await page.getByText('Prize chart', { exact: true }).click()
  await expect(prizes).toBeHidden()
})

for (const viewport of [{ width: 1280, height: 1100 }, { width: 390, height: 844 }]) {
  test(`Draw again can be skipped without moving the pointer at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await deterministicWords(page, [...words, 0, 0, 0, 0, 0, 7, 0])
    await seed(page, fixture('pb', 'issued'))
    const skip = page.getByRole('button', { name: 'Skip to results' })
    const redraw = page.getByRole('button', { name: 'Draw again' })
    await start(page).click()
    await skip.click()
    await expect(ticket(page)).toContainText('2 jackpot-winning plays')
    await redraw.scrollIntoViewIfNeeded()
    const before = (await redraw.boundingBox())!
    const scroll = await page.evaluate(() => window.scrollY)
    const x = before.x + before.width / 2
    const y = before.y + before.height / 2

    await page.mouse.click(x, y)
    await expect(skip).toBeVisible()
    const after = (await skip.boundingBox())!
    expect(Math.abs(after.x - before.x)).toBeLessThan(1)
    expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll)
    await expect(results(page)).toHaveCount(0)

    await page.mouse.click(x, y)
    await expect(ticket(page)).toContainText('$8')
    await expect(balls(page)).toHaveText(['01', '02', '03', '04', '05', '08'])
  })
}

import { expect, test } from '@playwright/test'
import { balls, deterministicWords, fixture, results, seed, start, ticket } from './fixtures'

test('concurrent confirms print one ID and independent per-play multipliers', async ({ page, context }) => {
  await deterministicWords(page, [0, 29])
  await seed(page, fixture('mm', 'review'))
  const other = await context.newPage()
  await deterministicWords(other, [0, 29])
  await other.goto('/')
  const confirm = (tab: typeof page) => tab.getByRole('button', { name: 'Confirm & print' })
  await expect(confirm(page)).toBeEnabled()
  await expect(confirm(other)).toBeEnabled()
  await Promise.all([
    confirm(page).evaluate((button: HTMLButtonElement) => button.click()),
    confirm(other).evaluate((button: HTMLButtonElement) => button.click()),
  ])
  await expect(start(page)).toBeVisible()
  await expect(start(other)).toBeVisible()
  const id = await ticket(page).getByTestId('ticket-id').textContent()
  await expect(ticket(other).getByTestId('ticket-id')).toHaveText(id!)
  const lines = ticket(page).getByTestId('ticket-line')
  await expect(lines.nth(0)).toContainText('2×')
  await expect(lines.nth(1)).toContainText('5×')
  await page.reload()
  await expect(ticket(page).getByTestId('ticket-id')).toHaveText(id!)
  await expect(ticket(page).getByTestId('ticket-line').nth(1)).toContainText('5×')
})

test('a failed confirm stays in review and Retry issues the saved five-line ticket', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page, fixture('pb', 'review'))
  await page.screenshot({ path: info.outputPath('confirmation.png') })
  await page.evaluate(() => {
    const previous = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function () {
      IDBObjectStore.prototype.put = previous
      throw new DOMException('Storage full', 'QuotaExceededError')
    }
  })
  await page.getByRole('button', { name: 'Confirm & print' }).click()
  await expect(page.getByRole('heading', { name: 'Review your plays' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Storage full')
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(ticket(page)).toBeVisible()
  const id = await ticket(page).getByTestId('ticket-id').textContent()
  await page.reload()
  await expect(ticket(page).getByTestId('ticket-id')).toHaveText(id!)
  await expect(ticket(page).getByTestId('ticket-line')).toHaveCount(5)
  await expect(ticket(page).getByTestId('ticket-line').last()).toBeVisible()
  await expect(start(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({ path: info.outputPath('issued.png'), fullPage: true })
})

test('the chooser can resume a printed ticket or start a new one', async ({ page }) => {
  await seed(page, fixture('mm', 'issued'))
  const home = page.getByRole('button', { name: 'Live Lotto home' })
  const chooser = page.getByRole('heading', { name: 'Choose your game.' })
  const saved = ticket(page).getByTestId('ticket-id')
  const id = await saved.textContent()
  await home.click()
  await expect(chooser).toBeFocused()
  await page.reload()
  await expect(chooser).toBeVisible()
  await page.getByRole('button', { name: 'Resume ticket' }).click()
  await expect(saved).toHaveText(id!)
  await start(page).click()
  await expect(page.getByRole('button', { name: 'Skip to results' })).toBeVisible()
  await home.click()
  await expect(chooser).toBeVisible()
  await page.getByRole('button', { name: 'Resume ticket' }).click()
  await expect(results(page)).toBeVisible()
  await expect(balls(page)).toHaveCount(6)
  await expect(saved).toHaveText(id!)
  await home.click()
  await page.getByRole('button', { name: /Mega Millions.*5/ }).click()
  await expect(page.getByRole('heading', { name: /Mega Millions Board A/ })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeDisabled()
  await home.click()
  await expect(chooser).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume ticket' })).toHaveCount(0)
})

test('Home requested during Start opens the chooser after the draw is saved', async ({ page }) => {
  await seed(page, fixture('pb', 'issued'))
  await expect(start(page)).toBeVisible()
  await start(page).evaluate((button: HTMLButtonElement) => {
    button.click()
    document.querySelector<HTMLButtonElement>('button[aria-label="Live Lotto home"]')!.click()
  })
  await expect(page.getByRole('heading', { name: 'Choose your game.' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume ticket' }).click()
  await expect(results(page)).toBeVisible()
  await expect(balls(page)).toHaveCount(6)
})

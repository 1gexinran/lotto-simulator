import { expect, test } from '@playwright/test'
import { deterministicWords, fixture, seed, start, ticket } from './fixtures'

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

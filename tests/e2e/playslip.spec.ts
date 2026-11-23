import { expect, test } from '@playwright/test'

test('partial and cleared boards survive navigation and preserve skipped letters', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Powerball.*2/ }).click()
  for (const number of [1, 2, 3, 4, 5]) await page.getByRole('button', { name: `White number ${number}`, exact: true }).click()
  await page.getByRole('button', { name: 'Powerball 5', exact: true }).click()
  await page.getByRole('button', { name: 'Next play', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Board B/ })).toBeFocused()
  await page.getByRole('button', { name: 'White number 42', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Next play', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous play', exact: true }).click()
  await page.getByRole('button', { name: 'Next board', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Board B/ })).toBeFocused()
  await page.reload()
  await expect(page.getByRole('button', { name: 'White number 42', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Quick Pick whole play' }).click()
  await page.getByRole('button', { name: 'Next play', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Board C/ })).toBeFocused()
  await page.getByRole('button', { name: 'Quick Pick whole play' }).click()
  await page.getByRole('button', { name: 'Previous play', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Board B/ })).toBeFocused()
  await page.getByRole('button', { name: 'Clear play' }).click()
  await expect(page.getByText('2 completed plays.', { exact: true })).toBeVisible()
  await page.getByLabel(/Power Play/).click()
  await expect(page.getByLabel(/Power Play/)).toBeChecked()
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review your plays' })).toBeFocused()
  await expect(page.getByText('Play A', { exact: true })).toBeVisible()
  await expect(page.getByText('Play C', { exact: true })).toBeVisible()
  await expect(page.getByText('Play B', { exact: true })).toHaveCount(0)
  await expect(page.getByText('$6.00', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm & print' })).toBeDisabled()
  await page.getByLabel('Cash value').click()
  await expect(page.getByRole('button', { name: 'Confirm & print' })).toBeEnabled()
  await page.getByRole('button', { name: 'Back to playslip' }).click()
  await expect(page.getByRole('heading', { name: /Board B/ })).toBeFocused()
})

test('a payment election made during a previous draft write is saved', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Mega Millions.*5/ }).click()
  const quick = page.getByRole('button', { name: 'Quick Pick whole play' })
  await expect(quick).toBeVisible()
  await page.evaluate(() => {
    const whole = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button =>
      !button.closest('[inert]') && button.textContent === 'Quick Pick whole play')
    whole!.click()
    document.querySelector<HTMLInputElement>('section:not([inert]) input[type="radio"][name="payment"]')!.click()
  })
  await expect(page.getByLabel('Cash value')).toBeChecked()
  await page.reload()
  await expect(page.getByLabel('Cash value')).toBeChecked()
})

test('a successful Retry clears a read error without requiring a new revision', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Choose your game.' })).toBeVisible()
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      if (mode === 'readonly') {
        IDBDatabase.prototype.transaction = original
        throw new DOMException('Read interrupted', 'UnknownError')
      }
      return original.call(this, stores, mode, options)
    }
    const trigger = new BroadcastChannel('live-lotto-round')
    trigger.postMessage('round changed')
    trigger.close()
  })
  await expect(page.getByRole('alert')).toContainText('Read interrupted')
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Choose your game.' })).toBeVisible()
})

import { expect, test } from '@playwright/test'

test('nine of ten marks paint within 100 ms at four-times CPU slowdown', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'chromium', 'CPU emulation is provided by Chromium CDP.')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: /Powerball.*2/ }).click()
  await page.evaluate(() => document.fonts.ready.then(() => true))
  const mark = page.getByRole('button', { name: 'White number 1', exact: true })
  await expect(mark).toBeVisible()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const samples: number[] = []
  for (let attempt = 0; attempt < 10; attempt++) {
    const old = await mark.getAttribute('aria-pressed')
    await mark.evaluate(element => {
      element.removeAttribute('data-feedback-ms')
      element.addEventListener('click', () => {
        const began = performance.now()
        const observer = new MutationObserver(() => {
          observer.disconnect()
          requestAnimationFrame(() => requestAnimationFrame(() => {
            element.setAttribute('data-feedback-ms', String(performance.now() - began))
          }))
        })
        observer.observe(element, { attributes: true, attributeFilter: ['aria-pressed'] })
      }, { once: true, capture: true })
    })
    await mark.click()
    await expect(mark).toHaveAttribute('aria-pressed', old === 'true' ? 'false' : 'true')
    await expect(mark).toHaveAttribute('data-feedback-ms', /[0-9]/)
    samples.push(Number(await mark.getAttribute('data-feedback-ms')))
  }
  await info.attach('selection-feedback.json', {
    body: JSON.stringify({ browser: info.project.name, slowdown: 4, samplesMs: samples }, null, 2),
    contentType: 'application/json',
  })
  console.log('4× CPU selection feedback (ms):', samples.map(sample => sample.toFixed(1)).join(', '))
  expect(samples.filter(sample => sample <= 100).length).toBeGreaterThanOrEqual(9)
})

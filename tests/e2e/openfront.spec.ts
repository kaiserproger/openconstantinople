import { expect, test } from '@playwright/test'

test('builds, saves, reloads, and fights on the live map', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  const seedBefore = await page.getByTestId('seed').textContent()
  await expect(page.getByTestId('placed-building')).toHaveCount(8)

  await page.locator('[data-kind="house"]').click()
  await page.getByTestId('world').click({ position: { x: 780, y: 410 } })
  await expect(page.getByTestId('placed-building')).toHaveCount(9)

  await page.locator('[data-action="save"]').click()
  await expect(page.getByTestId('notice')).toContainText('Поселение сохранено')
  await page.locator('[data-action="new-world"]').click()
  await expect(page.getByTestId('seed')).not.toHaveText(seedBefore ?? '')
  await page.locator('[data-action="load"]').click()
  await expect(page.getByTestId('placed-building')).toHaveCount(9)

  await page.locator('[data-action="attack"]').click()
  await expect(page.getByTestId('friendly-unit').first()).toBeVisible()
  await expect(page.getByTestId('enemy-unit').first()).toBeVisible()
  await page.screenshot({ path: 'docs/qa/openfront-raid-1672x941.png' })
  expect(errors).toEqual([])
})

test('holds the raid scene at a 60 fps-class frame cadence with 300 units', async ({ page }) => {
  await page.goto('/?stress=1')
  await page.locator('[data-action="attack"]').click()
  await expect(page.getByTestId('friendly-unit')).toHaveCount(150)
  await expect(page.getByTestId('enemy-unit')).toHaveCount(150)

  const timing = await page.evaluate(async () => {
    const samples: number[] = []
    await new Promise<void>((resolve) => {
      let previous = performance.now()
      let frames = 0
      const tick = (now: number) => {
        samples.push(now - previous)
        previous = now
        frames += 1
        if (frames >= 180) resolve()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const stable = samples.slice(10)
    const averageFrameMs = stable.reduce((sum, sample) => sum + sample, 0) / stable.length
    return {
      averageFrameMs,
      averageFps: 1000 / averageFrameMs,
      maxFrameMs: Math.max(...stable),
    }
  })

  test.info().annotations.push({
    type: 'performance',
    description: `${timing.averageFps.toFixed(1)} fps average; ${timing.maxFrameMs.toFixed(1)} ms slowest frame`,
  })
  console.info(`[raid-performance] ${timing.averageFps.toFixed(1)} fps average; ${timing.maxFrameMs.toFixed(1)} ms slowest frame; 300 units`)
  expect(timing.averageFps).toBeGreaterThanOrEqual(59)
})

import { expect, test } from '@playwright/test'

test('builds, rotates, saves, reloads, and fights on the live voxel map', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await page.locator('[data-speed="0"]').click()
  await expect(page.getByTestId('speed-label')).toHaveText('0×')
  await expect(page.getByTestId('voxel-world')).toBeVisible()
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-tool', 'none')
  await expect(page.getByText('Порфирополис').first()).toBeVisible()
  const seedBefore = await page.getByTestId('seed').textContent()
  const woodBefore = Number(await page.locator('[data-resource="wood"] b').textContent())

  await page.locator('[data-action="toggle-court"]').click()
  await expect(page.getByTestId('edge-drawer')).toContainText('Двор стратега')
  await expect(page.getByTestId('edge-drawer')).toContainText('Кризисов нет')
  await page.locator('[data-action="toggle-intel"]').click()
  await expect(page.getByTestId('edge-drawer')).toContainText('Разведка')
  await expect(page.getByTestId('edge-drawer')).toHaveCount(1)

  await page.getByTestId('voxel-world').hover({ position: { x: 600, y: 240 } })
  await expect(page.getByTestId('building-tooltip')).toContainText('Дворец стратега')
  await page.getByTestId('voxel-world').click({ position: { x: 600, y: 240 } })
  await expect(page.getByTestId('edge-drawer')).toContainText('Дворец стратега')
  await expect(page.locator('[data-action="demolish-building"]')).toBeDisabled()
  await page.getByTestId('edge-drawer').getByRole('button', { name: 'Закрыть' }).click()

  await page.locator('[data-kind="house"]').click()
  await page.getByTestId('voxel-world').click({ position: { x: 276, y: 444 } })
  await expect(page.getByTestId('notice')).toContainText('Инсула заложена')
  await expect(page.locator('[data-resource="wood"] b')).toHaveText(String(woodBefore - 8))

  await page.locator('[data-mode="streets"]').click()
  await page.locator('[data-kind="road"]').click()
  await expect(page.getByTestId('construction-hint')).toContainText('Тяните ЛКМ по прямой')
  await page.getByTestId('voxel-world').hover({ position: { x: 249, y: 459 } })
  await page.mouse.down()
  await page.mouse.move(340, 512, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByTestId('notice')).toContainText('Проложено клеток улицы')
  const woodAfterConstruction = await page.locator('[data-resource="wood"] b').textContent()

  const quarterBefore = await page.getByTestId('camera-state').getAttribute('data-quarter')
  await page.keyboard.press('KeyE')
  await expect(page.getByTestId('camera-state')).not.toHaveAttribute('data-quarter', quarterBefore ?? '0')

  await page.locator('[data-action="save"]').click()
  await expect(page.getByTestId('notice')).toContainText('Княжество сохранено')
  await page.locator('[data-action="new-world"]').click()
  await expect(page.getByTestId('seed')).not.toHaveText(seedBefore ?? '')
  await page.locator('[data-action="load"]').click()
  await expect(page.locator('[data-resource="wood"] b')).toHaveText(woodAfterConstruction ?? '')

  await page.locator('[data-action="attack"]').click()
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-battle', 'true')
  await expect(page.getByTestId('notice')).toContainText('Налёт отбит')
  expect(errors).toEqual([])
})

test('holds the instanced raid at a 60 fps-class cadence with 300 units', async ({ page }) => {
  await page.goto('/?stress=1')
  await page.getByTestId('voxel-world').click({ position: { x: 600, y: 240 } })
  await expect(page.getByTestId('object-card')).toBeVisible()
  await page.locator('[data-action="attack"]').click()
  await expect.poll(async () => page.evaluate(() => window.__OPENFRONT_METRICS__?.visibleUnits)).toBe(300)
  await page.waitForTimeout(3200)

  const metrics = await page.evaluate(() => window.__OPENFRONT_METRICS__!)
  test.info().annotations.push({
    type: 'performance',
    description: `${metrics.averageFps.toFixed(1)} fps; ${metrics.p95FrameMs.toFixed(1)} ms p95; ${metrics.drawCalls} draw calls`,
  })
  console.info(`[raid-performance] ${metrics.averageFps.toFixed(1)} fps; ${metrics.p95FrameMs.toFixed(1)} ms p95; ${metrics.drawCalls} draw calls; 300 units`)
  expect(metrics.averageFps).toBeGreaterThanOrEqual(59)
  expect(metrics.drawCalls).toBeLessThanOrEqual(24)
})

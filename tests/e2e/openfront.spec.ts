import { expect, test } from '@playwright/test'
import { MatchServer } from '../../server/MatchServer'
import { createCampaign } from '../../src/game/campaign'
import { createFinalCampaign } from '../fixtures/finalCampaign'

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
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-battle-outcome', 'none')
  await expect(page.getByTestId('battle-command-bar')).toContainText('Боевые построения')
  await page.locator('[data-formation="militia"]').click()
  await page.locator('[data-shape="shieldwall"]').click()
  await page.getByTestId('voxel-world').click({ position: { x: 620, y: 260 } })
  await page.locator('[data-formation="spears"]').click()
  await page.locator('[data-shape="shieldwall"]').click()
  await page.getByTestId('voxel-world').click({ position: { x: 680, y: 290 } })
  await page.locator('[data-formation="archers"]').click()
  await page.locator('[data-shape="line"]').click()
  await page.getByTestId('voxel-world').click({ position: { x: 580, y: 360 } })
  await page.locator('[data-formation="retinue"]').click()
  await page.locator('[data-shape="wedge"]').click()
  await page.getByTestId('voxel-world').click({ position: { x: 760, y: 330 } })
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-battle-orders', '4')
  const firstRetinueOrder = await page.getByTestId('voxel-world').getAttribute('data-battle-command')
  await page.locator('[data-formation="retinue"]').click()
  await page.getByTestId('voxel-world').click({ position: { x: 800, y: 300 } })
  await expect(page.getByTestId('voxel-world')).not.toHaveAttribute('data-battle-command', firstRetinueOrder ?? 'none')
  await page.locator('[data-action="execute-battle-plan"]').click()
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-battle-executing', 'true')
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-battle-outcome', 'victory')
  await expect(page.getByTestId('battle-report')).toContainText('Схватка у Северных ворот')
  await expect(page.getByTestId('notice')).toContainText('Налёт отбит')
  expect(errors).toEqual([])
})

test('holds the instanced raid at a 60 fps-class cadence with 300 units', async ({ page }) => {
  await page.goto('/?stress=1')
  await page.getByTestId('voxel-world').click({ position: { x: 600, y: 240 } })
  await expect(page.getByTestId('object-card')).toBeVisible()
  await page.locator('[data-action="attack"]').click()
  await page.locator('[data-formation="militia"]').click()
  for (const position of [{ x: 620, y: 260 }, { x: 680, y: 290 }, { x: 580, y: 360 }, { x: 760, y: 330 }]) {
    await page.getByTestId('voxel-world').click({ position })
  }
  await page.locator('[data-action="execute-battle-plan"]').click()
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

test('captures and persists an adjacent province on the strategic realm map', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.goto('/')
  await page.locator('[data-action="toggle-realm"]').click()
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')
  await expect(page.getByTestId('campaign-title')).toContainText('15 провинций')

  await page.getByTestId('voxel-world').click({ position: { x: 650, y: 515 } })
  await expect(page.getByTestId('campaign-target')).toContainText('14 защитников')
  await page.locator('[data-field="campaign-commitment"]').fill('75')
  await page.locator('[data-action="campaign-attack"]').click()

  await expect(page.getByTestId('campaign-title')).toContainText('16 провинций')
  await expect(page.getByTestId('notice')).toContainText('захватывает')
  await page.locator('[data-action="save"]').click()
  await page.locator('[data-action="return-city"]').click()
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'city')
  await page.locator('[data-action="new-world"]').click()
  await page.locator('[data-action="load"]').click()
  await page.locator('[data-action="toggle-realm"]').click()
  await expect(page.getByTestId('campaign-title')).toContainText('16 провинций')
  expect(errors).toEqual([])
})

test('negotiates with medieval rulers and observes autonomous rival expansion', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.setViewportSize({ width: 1672, height: 941 })
  await page.goto('/')
  await page.locator('[data-speed="0"]').click()
  await page.locator('[data-action="toggle-realm"]').click()

  await expect(page.getByTestId('campaign-ledger')).toContainText('Сельджуки')
  await expect(page.locator('[data-realm="seljuk"]')).toContainText('12 земель · война')
  await expect(page.locator('[data-realm="bulgar"]')).toContainText('9 земель · нейтралитет')

  await page.locator('[data-realm="seljuk"]').click()
  await expect(page.getByTestId('diplomacy-panel')).toContainText('Дом Кынык')
  await expect(page.getByTestId('diplomacy-panel')).toContainText('Неутомимый завоеватель')
  await page.locator('[data-action="offer-truce"]').click()
  await expect(page.getByTestId('diplomacy-panel')).toContainText('Перемирие')
  await page.getByRole('button', { name: 'Закрыть' }).click()

  await page.locator('[data-realm="bulgar"]').click()
  await expect(page.locator('[data-action="form-alliance"]')).toBeDisabled()
  await page.locator('[data-action="send-gift"]').click()
  await page.locator('[data-action="send-gift"]').click()
  await expect(page.getByTestId('diplomatic-opinion')).toHaveText('+60')
  await expect(page.locator('[data-resource="silver"]')).toContainText('32')
  await expect(page.locator('[data-action="form-alliance"]')).toBeEnabled()
  await page.locator('[data-action="form-alliance"]').click()
  await expect(page.getByTestId('diplomacy-panel')).toContainText('Союз')
  await expect(page.locator('[data-realm="bulgar"]')).toContainText('союз')

  await page.locator('[data-action="save"]').click()
  await page.locator('[data-action="new-world"]').click()
  await page.locator('[data-action="load"]').click()
  await page.locator('[data-action="toggle-realm"]').click()
  await page.locator('[data-realm="bulgar"]').click()
  await expect(page.getByTestId('diplomacy-panel')).toContainText('Союз')
  await page.getByRole('button', { name: 'Закрыть' }).click()

  await page.locator('[data-speed="4"]').click()
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '2', { timeout: 5_000 })
  await expect(page.getByTestId('campaign-march-summary')).toContainText('2 похода в пути')
  await expect(page.getByTestId('campaign-march-summary')).toContainText('Сельджуки')
  await expect(page.getByTestId('campaign-march-summary')).toContainText('Болгары')
  await expect(page.locator('[data-realm="seljuk"]')).toContainText('12 земель')
  await expect(page.locator('[data-realm="bulgar"]')).toContainText('9 земель')
  await page.locator('[data-speed="0"]').click()

  await expect(page.locator('[data-realm="seljuk"]')).toContainText('13 земель', { timeout: 10_000 })
  await expect(page.locator('[data-realm="bulgar"]')).toContainText('10 земель')
  await expect(page.getByTestId('notice')).toContainText('захватывает')
  await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
  await expect(page.getByTestId('voxel-world')).not.toHaveAttribute('data-campaign-event-province', 'none')
  expect(errors).toEqual([])
})

test('requires the invited ruler to accept a multiplayer alliance', async ({ page, browser }) => {
  test.setTimeout(30_000)
  const matchServer = new MatchServer({
    campaignDayMs: 60_000,
    marchDurationMs: 1500,
    campaignFactory: (seed) => {
      const campaign = createCampaign(seed)
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
      source.levies = 80
      target.owner = 'bulgar'
      target.levies = 20
      return campaign
    },
  })
  await matchServer.listen(5175)
  await page.setViewportSize({ width: 1672, height: 941 })
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const secondPage = await secondContext.newPage()
  const roomId = `alliance-${Date.now().toString(36)}`
  const errors: string[] = []
  for (const target of [page, secondPage]) {
    target.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
  }

  async function joinMatch(target: typeof page, playerName: string, nationId: string): Promise<void> {
    await target.goto('/')
    await target.locator('[data-speed="0"]').click()
    await target.locator('[data-action="toggle-multiplayer"]').click()
    await target.locator('[data-field="player-name"]').fill(playerName)
    await target.locator('[data-field="room-id"]').fill(roomId)
    await target.locator(`[data-nation="${nationId}"]`).click()
    await target.locator('[data-action="join-match"]').click()
    await expect(target.getByTestId('multiplayer-lobby')).toContainText('Сбор в комнате')
  }

  try {
    await joinMatch(page, 'Alexios', 'porphyry')
    await joinMatch(secondPage, 'Tervel', 'bulgar')
    await page.locator('[data-action="match-ready"]').click()
    await secondPage.locator('[data-action="match-ready"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')

    await page.locator('[data-realm="bulgar"]').click()
    await page.locator('[data-action="send-gift"]').click()
    await expect(page.getByTestId('diplomatic-opinion')).toHaveText('+35')
    await page.locator('[data-action="send-gift"]').click()
    await expect(page.getByTestId('diplomatic-opinion')).toHaveText('+60')
    await page.locator('[data-action="form-alliance"]').click()

    await expect(page.getByTestId('alliance-offer')).toContainText('Ожидается ответ правителя')
    await expect(page.getByTestId('diplomacy-panel')).toContainText('Нейтралитет')
    await expect(page.locator('[data-realm="bulgar"]')).toContainText('ждёт ответа')
    await expect(secondPage.getByTestId('diplomacy-panel')).toBeVisible()
    await expect(secondPage.getByTestId('alliance-offer')).toContainText('Предложение союза')
    await expect(secondPage.locator('[data-realm="porphyry"]')).toContainText('предлагает союз')
    await expect(secondPage.locator('[data-action="accept-alliance"]')).toBeVisible()
    await expect(secondPage.locator('[data-action="decline-alliance"]')).toBeVisible()
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 5')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 5')

    await secondPage.locator('[data-action="accept-alliance"]').click()
    await expect(page.getByTestId('diplomacy-panel')).toContainText('Союз')
    await expect(secondPage.getByTestId('diplomacy-panel')).toContainText('Союз')
    await expect(page.locator('[data-realm="bulgar"]')).toContainText('союз')
    await expect(secondPage.locator('[data-realm="porphyry"]')).toContainText('союз')
    await expect(page.getByTestId('alliance-offer')).toHaveCount(0)
    await expect(secondPage.getByTestId('alliance-offer')).toHaveCount(0)
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 6')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 6')

    await expect(page.getByTestId('alliance-support')).toContainText('Казна и подкрепления')
    await expect(page.getByTestId('alliance-support')).toContainText('Выберите свою провинцию и соседнюю землю союзника')
    await page.locator('[data-alliance-silver="30"]').click()
    await expect(page.getByTestId('campaign-income')).toContainText('казна 2')
    await expect(page.getByTestId('allied-treasury')).toHaveText('122')
    await expect(secondPage.getByTestId('campaign-income')).toContainText('казна 122')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 7')

    await page.getByRole('button', { name: 'Закрыть' }).click()
    await page.getByTestId('voxel-world').click({ position: { x: 650, y: 515 } })
    await expect(page.getByTestId('campaign-target')).toContainText('20 защитников')
    await page.locator('[data-action="open-diplomacy"]').click()
    await expect(page.getByTestId('alliance-support')).toContainText('В путь выступят 40 ратников')
    await page.locator('[data-action="send-alliance-support"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-march-kinds', 'support')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 8')
    await expect(page.locator('[data-action="send-alliance-support"]')).toBeDisabled()

    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(secondPage.getByTestId('notice')).toContainText('присылает 40 ратников')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 9')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 9')
    expect(errors).toEqual([])
  } finally {
    await secondContext.close()
    await matchServer.close()
  }
})

test('opens, embargoes, and restores a shared medieval market route', async ({ page, browser }) => {
  test.setTimeout(30_000)
  const matchServer = new MatchServer({
    campaignDayMs: 60_000,
    campaignFactory: (seed) => {
      const campaign = createCampaign(seed)
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
      source.marketLevel = 1
      target.owner = 'bulgar'
      target.marketLevel = 1
      return campaign
    },
  })
  await matchServer.listen(5175)
  await page.setViewportSize({ width: 1672, height: 941 })
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const secondPage = await secondContext.newPage()
  const roomId = `trade-${Date.now().toString(36)}`
  const errors: string[] = []
  for (const target of [page, secondPage]) {
    target.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
  }

  async function joinMatch(target: typeof page, playerName: string, nationId: string): Promise<void> {
    await target.goto('/')
    await target.locator('[data-speed="0"]').click()
    await target.locator('[data-action="toggle-multiplayer"]').click()
    await target.locator('[data-field="player-name"]').fill(playerName)
    await target.locator('[data-field="room-id"]').fill(roomId)
    await target.locator(`[data-nation="${nationId}"]`).click()
    await target.locator('[data-action="join-match"]').click()
    await expect(target.getByTestId('multiplayer-lobby')).toContainText('Сбор в комнате')
  }

  try {
    await joinMatch(page, 'Alexios', 'porphyry')
    await joinMatch(secondPage, 'Tervel', 'bulgar')
    await page.locator('[data-action="match-ready"]').click()
    await secondPage.locator('[data-action="match-ready"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')

    await page.getByTestId('voxel-world').click({ position: { x: 650, y: 515 } })
    await page.locator('[data-action="open-diplomacy"]').click()
    await expect(page.getByTestId('realm-trade')).toContainText('Караванный путь')
    await expect(page.getByTestId('realm-trade')).toContainText('Свой торг1')
    await expect(page.getByTestId('realm-trade')).toContainText('Соседний торг1')
    await expect(page.locator('[data-action="open-trade-route"]')).toBeEnabled()
    await page.locator('[data-action="open-trade-route"]').click()

    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-trade-routes', '1')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-trade-routes', '1')
    await expect(page.getByTestId('trade-income')).toContainText('+6 в день')
    await expect(page.locator('[data-realm="bulgar"]')).toContainText('торг')
    await expect(secondPage.locator('[data-realm="porphyry"]')).toContainText('торг')

    await secondPage.locator('[data-realm="porphyry"]').click()
    await expect(secondPage.getByTestId('trade-income')).toContainText('+6 в день')
    await secondPage.locator('[data-action="embargo-trade"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-trade-routes', '0')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-trade-routes', '0')
    await expect(page.getByTestId('realm-trade')).toContainText('Торговля закрыта соседом')
    await expect(secondPage.getByTestId('realm-trade')).toContainText('Торговля остановлена')
    await expect(page.locator('[data-realm="bulgar"]')).toContainText('эмбарго')

    await secondPage.locator('[data-action="resume-trade"]').click()
    await expect(page.locator('[data-action="open-trade-route"]')).toBeEnabled()
    await page.locator('[data-action="open-trade-route"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-trade-routes', '1')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-trade-routes', '1')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 6')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 6')
    expect(errors).toEqual([])
  } finally {
    await secondContext.close()
    await matchServer.close()
  }
})

test('settles a won war through one accepted border demand', async ({ page, browser }) => {
  test.setTimeout(30_000)
  let demandedProvinceId = -1
  let demandedProvinceName = ''
  const matchServer = new MatchServer({
    campaignDayMs: 60_000,
    campaignFactory: (seed) => {
      const campaign = createCampaign(seed)
      const candidate = campaign.provinces.find((province) => (
        province.owner === 'seljuk'
        && province.capitalOf !== 'seljuk'
        && campaign.provinces.some((neighbor) => (
          neighbor.owner !== 'seljuk'
          && Math.abs(neighbor.column - province.column) + Math.abs(neighbor.row - province.row) === 1
        ))
      ))!
      demandedProvinceId = candidate.id
      demandedProvinceName = candidate.name
      const bridge = campaign.provinces.find((province) => (
        province.owner !== 'seljuk'
        && Math.abs(province.column - candidate.column) + Math.abs(province.row - candidate.row) === 1
      ))!
      bridge.owner = 'porphyry'
      for (const province of campaign.provinces) {
        if (
          province.homelandOf === 'seljuk'
          && province.id !== candidate.id
          && province.capitalOf !== 'seljuk'
        ) province.owner = 'porphyry'
      }
      return campaign
    },
  })
  await matchServer.listen(5175)
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const secondPage = await secondContext.newPage()
  const roomId = `peace-${Date.now().toString(36)}`

  async function join(target: typeof page, name: string, nation: string): Promise<void> {
    await target.goto('/')
    await target.locator('[data-speed="0"]').click()
    await target.locator('[data-action="toggle-multiplayer"]').click()
    await target.locator('[data-field="player-name"]').fill(name)
    await target.locator('[data-field="room-id"]').fill(roomId)
    await target.locator(`[data-nation="${nation}"]`).click()
    await target.locator('[data-action="join-match"]').click()
  }

  try {
    await join(page, 'Alexios', 'porphyry')
    await join(secondPage, 'Kutlug', 'seljuk')
    await page.locator('[data-action="match-ready"]').click()
    await secondPage.locator('[data-action="match-ready"]').click()
    await page.locator('[data-realm="seljuk"]').click()

    await expect(page.getByTestId('peace-council')).toContainText('Военный счёт +')
    const demand = page.locator(`[data-peace-demand="${demandedProvinceId}"]`)
    await expect(demand).toContainText(demandedProvinceName)
    await expect(demand).toBeEnabled()
    await demand.click()

    await expect(secondPage.getByTestId('peace-offer')).toContainText(`Уступить ${demandedProvinceName}`)
    await secondPage.locator('[data-action="accept-peace"]').click()
    await expect(page.getByTestId('diplomacy-panel')).toContainText('Перемирие')
    await expect(page.getByTestId('campaign-title')).toContainText('провинций')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 4')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 4')
  } finally {
    await secondContext.close()
    await matchServer.close()
  }
})

test('besieges one fortified province with synchronized attacker and defender decisions', async ({ page, browser }) => {
  test.setTimeout(30_000)
  const matchServer = new MatchServer({
    campaignDayMs: 60_000,
    marchDurationMs: 900,
    marchPollMs: 5,
    campaignFactory: (seed) => {
      const campaign = createCampaign(seed)
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
      const defenderReserve = campaign.provinces.find((province) => province.column === 4 && province.row === 5)!
      source.levies = 120
      source.cityLevel = 1
      source.marketLevel = 1
      source.workshopLevel = 1
      target.owner = 'seljuk'
      target.levies = 40
      target.fortificationLevel = 1
      target.defenseFormation = 'line'
      defenderReserve.owner = 'seljuk'
      defenderReserve.levies = 80
      return campaign
    },
  })
  await matchServer.listen(5175)
  await page.setViewportSize({ width: 1672, height: 941 })
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const secondPage = await secondContext.newPage()
  const roomId = `siege-${Date.now().toString(36)}`
  const errors: string[] = []
  for (const target of [page, secondPage]) {
    target.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
  }

  async function joinMatch(target: typeof page, playerName: string, nationId: string): Promise<void> {
    await target.goto('/')
    await target.locator('[data-speed="0"]').click()
    await target.locator('[data-action="toggle-multiplayer"]').click()
    await target.locator('[data-field="player-name"]').fill(playerName)
    await target.locator('[data-field="room-id"]').fill(roomId)
    await target.locator(`[data-nation="${nationId}"]`).click()
    await target.locator('[data-action="join-match"]').click()
    await expect(target.getByTestId('multiplayer-lobby')).toContainText('Сбор в комнате')
  }

  try {
    await joinMatch(page, 'Alexios', 'porphyry')
    await joinMatch(secondPage, 'Kutlug', 'seljuk')
    await page.locator('[data-action="match-ready"]').click()
    await secondPage.locator('[data-action="match-ready"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')

    await page.getByTestId('voxel-world').click({ position: { x: 650, y: 515 } })
    await expect(page.getByTestId('campaign-target')).toContainText('стены 1')
    await page.locator('[data-field="campaign-commitment"]').fill('75')
    await page.locator('[data-march-formation="wedge"]').click()
    await page.locator('[data-action="campaign-attack"]').click()

    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-sieges', '1')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-sieges', '1')
    await expect(page.getByTestId('siege-command-bar')).toContainText('Ваш осадный лагерь')
    await expect(secondPage.getByTestId('siege-command-bar')).toContainText('Ваш гарнизон в осаде')
    await expect(page.getByTestId('siege-supplies')).toContainText('12 · 6 дн.')
    await expect(secondPage.getByTestId('siege-supplies')).toContainText('12 · 6 дн.')
    await expect(page.getByTestId('siege-engines')).toContainText('1 маш.')
    await expect(secondPage.getByTestId('siege-engines')).toContainText('1 маш.')
    await expect(page.getByTestId('campaign-siege-summary')).toContainText('0%')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 4')

    await page.locator('[data-siege-tactic="sappers"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-siege-tactics', 'sappers')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-siege-tactics', 'sappers')
    await expect(page.locator('[data-siege-tactic="sappers"]')).toHaveClass(/active/)
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 5')

    await secondPage.locator('[data-action="sortie-siege"]').click()
    await expect(page.getByTestId('siege-progress')).toHaveText('10%')
    await expect(secondPage.getByTestId('siege-progress')).toHaveText('10%')
    await expect(secondPage.getByTestId('siege-command-bar')).toContainText('20 защитников')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 6')

    await secondPage.locator('[data-action="close-siege"]').click()
    await secondPage.getByTestId('voxel-world').click({ position: { x: 567, y: 433 } })
    await secondPage.getByTestId('voxel-world').click({ position: { x: 495, y: 391 } })
    await expect(secondPage.locator('[data-order-kind="siege-relief"]')).toContainText('Деблокировать')
    await secondPage.locator('[data-field="campaign-commitment"]').fill('25')
    await secondPage.locator('[data-march-formation="line"]').click()
    await secondPage.locator('[data-action="campaign-attack"]').click()
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(page.getByTestId('campaign-march-summary')).toContainText('деблокада')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(secondPage.getByTestId('notice')).toContainText('деблокирующая армия разбита')
    await expect(page.getByTestId('siege-progress')).toHaveText('0%')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 8')

    await page.locator('[data-action="close-siege"]').click()
    await page.getByTestId('voxel-world').click({ position: { x: 650, y: 515 } })
    await expect(page.getByTestId('campaign-command-bar')).toHaveAttribute('data-testid', 'campaign-command-bar')
    await expect(page.locator('[data-order-kind="siege-reinforce"]')).toContainText('Усилить осаду')
    await page.locator('[data-field="campaign-commitment"]').fill('50')
    await page.locator('[data-march-formation="shieldwall"]').click()
    await page.locator('[data-action="campaign-attack"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(page.getByTestId('campaign-march-summary')).toContainText('усиление осады')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 10')
    await page.locator('[data-siege]').click()
    await expect(page.getByTestId('siege-command-bar')).toContainText('83 осаждающих')

    await page.locator('[data-action="retreat-siege"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-sieges', '0')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-sieges', '0')
    await expect(page.getByTestId('siege-command-bar')).toHaveCount(0)
    await expect(secondPage.getByTestId('siege-command-bar')).toHaveCount(0)
    await expect(secondPage.getByTestId('notice')).toContainText('Осада снята')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 11')
    expect(errors).toEqual([])
  } finally {
    await secondContext.close()
    await matchServer.close()
  }
})

test('synchronizes nation economy, province governance, diplomacy, and borders across two browsers', async ({ page, browser }) => {
  test.setTimeout(60_000)
  const matchServer = new MatchServer({ campaignDayMs: 60_000, marchDurationMs: 1500, marchPollMs: 5 })
  await matchServer.listen(5175)
  await page.setViewportSize({ width: 1672, height: 941 })
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const secondPage = await secondContext.newPage()
  const roomId = `march-${Date.now().toString(36)}`

  async function joinMatch(target: typeof page, playerName: string, nationId: string): Promise<void> {
    await target.goto('/')
    await target.locator('[data-speed="0"]').click()
    await target.locator('[data-action="toggle-multiplayer"]').click()
    await target.locator('[data-field="player-name"]').fill(playerName)
    await target.locator('[data-field="room-id"]').fill(roomId)
    await target.locator(`[data-nation="${nationId}"]`).click()
    await target.locator('[data-action="join-match"]').click()
    await expect(target.getByTestId('multiplayer-lobby')).toContainText('Сбор в комнате')
  }

  try {
    await joinMatch(page, 'Alexios', 'porphyry')
    await joinMatch(secondPage, 'Kutlug', 'seljuk')

    await page.locator('[data-action="match-ready"]').click()
    await expect(page.getByTestId('multiplayer-lobby')).toContainText('1/2 правителей готовы')
    await expect(secondPage.getByTestId('multiplayer-lobby')).toContainText('1/2 правителей готовы')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'city')
    await secondPage.locator('[data-action="match-ready"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 2')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 2')

    await page.locator('[data-action="toggle-multiplayer"]').click()
    await expect(page.getByTestId('match-roster')).toContainText('Alexios')
    await expect(page.getByTestId('match-roster')).toContainText('Kutlug')
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await expect(secondPage.getByTestId('campaign-title')).toContainText('Сельджукский бейлик')
    await expect(secondPage.getByTestId('top-hud')).toContainText('Сельджуки')

    const sourceBeforeMuster = await page.getByTestId('campaign-source').textContent()
    await expect(page.getByTestId('campaign-income')).toContainText('казна 92')
    await page.locator('[data-action="campaign-muster"]').click()
    await expect(page.getByTestId('campaign-income')).toContainText('казна 68')
    await expect(page.getByTestId('campaign-source')).not.toHaveText(sourceBeforeMuster ?? '')
    await expect(secondPage.getByTestId('notice')).toContainText('собрано')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 3')

    await page.locator('[data-defense-formation="line"]').click()
    await expect(page.locator('[data-defense-formation="line"]')).toHaveClass(/active/)
    await expect(secondPage.getByTestId('notice')).toContainText('перестроен')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 4')

    await page.locator('[data-realm="seljuk"]').click()
    await page.locator('[data-action="offer-truce"]').click()
    await expect(page.getByTestId('peace-offer')).toContainText('Посольство отправлено')
    await expect(secondPage.getByTestId('peace-offer')).toContainText('Входящие условия')
    await expect(secondPage.locator('[data-realm="porphyry"]')).toContainText('предлагает мир')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 5')
    await secondPage.locator('[data-action="accept-peace"]').click()
    await expect(page.getByTestId('diplomacy-panel')).toContainText('Перемирие')
    await expect(secondPage.locator('[data-realm="porphyry"]')).toContainText('перемирие')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 6')
    await page.getByRole('button', { name: 'Закрыть' }).click()
    await secondPage.getByRole('button', { name: 'Закрыть' }).click()

    await page.getByTestId('voxel-world').click({ position: { x: 835, y: 410 } })
    const capturedProvinceName = await page.getByTestId('campaign-target').locator('strong').textContent()
    await expect(page.getByTestId('campaign-target')).toContainText('линия')
    await expect(page.getByTestId('campaign-target')).toContainText('Маршрут: 3 перехода')
    await page.locator('[data-field="campaign-commitment"]').fill('75')
    await page.locator('[data-march-formation="wedge"]').click()
    await page.locator('[data-action="campaign-attack"]').click()

    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-march-formations', 'wedge')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-march-routes', '42-34-26-27')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-march-legs', '3')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-march-routes', '42-34-26-27')
    await expect(page.getByTestId('campaign-march-summary')).toContainText('поход в пути')
    await expect(page.getByTestId('campaign-march-summary')).toContainText('маршрут 3')
    await expect(page.getByTestId('campaign-march-summary')).toContainText('Клин')
    await expect(page.getByTestId('campaign-march-summary')).toContainText(capturedProvinceName ?? '')
    await expect(page.locator('[data-action="campaign-recall"]')).toContainText('Отозвать поход')
    await expect(page.locator('[data-action="campaign-recall"]')).toContainText('потери 25%')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 7')
    await expect(page.getByTestId('campaign-title')).toContainText('15 провинций')

    await page.locator('[data-action="campaign-recall"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(page.getByTestId('notice')).toContainText('поход отозван')
    await expect(secondPage.getByTestId('notice')).toContainText('потери')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 8')
    await expect(page.locator('[data-action="campaign-attack"]')).toContainText('Начать поход')
    await page.locator('[data-action="campaign-attack"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 9')

    await expect(page.getByTestId('campaign-title')).toContainText('16 провинций', { timeout: 10_000 })
    await expect(page.getByTestId('campaign-source')).toContainText(capturedProvinceName ?? '')
    await expect(page.getByTestId('campaign-target')).toContainText('Выберите цель похода')
    await expect(page.getByTestId('match-revision')).toContainText('ревизия 10')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 10')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '0')
    await expect(secondPage.getByTestId('notice')).toContainText('захватывает')
    await expect(page.locator('[data-defense-formation="wedge"]')).toHaveClass(/active/)

    await page.locator('[data-action="open-domain"]').click()
    await expect(page.getByTestId('province-development')).toContainText(capturedProvinceName ?? '')
    await expect(page.locator('[data-action="develop-settlement"]')).toBeEnabled()
    await page.locator('[data-action="develop-settlement"]').click()
    await expect(page.getByTestId('campaign-income')).toContainText('казна 14')
    await expect(page.getByTestId('province-project')).toContainText('Расширить посад')
    await expect(page.getByTestId('province-project')).toContainText('2 дн.')
    await expect(secondPage.getByTestId('notice')).toContainText('начат проект')
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 11')
    await page.getByRole('button', { name: 'Закрыть' }).click()

    await page.locator('[data-action="return-city"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'city')
    await secondPage.locator('[data-action="campaign-muster"]').click()
    await expect(secondPage.getByTestId('match-revision')).toContainText('ревизия 12')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'city')

    await secondPage.locator('[data-action="toggle-multiplayer"]').click()
    await secondPage.locator('[data-action="leave-match"]').click()
    await expect(secondPage.getByTestId('campaign-title')).toContainText('Фема Порфирополиса')
    await expect(secondPage.getByTestId('match-revision')).toHaveCount(0)
  } finally {
    await secondContext.close()
    await matchServer.close()
  }
})

test('ends a shared war when the last enemy capital falls and leaves the loser observing', async ({ page, browser }) => {
  test.setTimeout(30_000)
  const matchServer = new MatchServer({
    campaignFactory: createFinalCampaign,
    campaignDayMs: 60_000,
    marchDurationMs: 1200,
    marchPollMs: 5,
  })
  await matchServer.listen(5175)
  await page.setViewportSize({ width: 1672, height: 941 })
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const secondPage = await secondContext.newPage()
  const roomId = `final-${Date.now().toString(36)}`
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  secondPage.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  async function joinMatch(target: typeof page, playerName: string, nationId: string): Promise<void> {
    await target.goto('/')
    await target.locator('[data-action="toggle-multiplayer"]').click()
    await target.locator('[data-field="player-name"]').fill(playerName)
    await target.locator('[data-field="room-id"]').fill(roomId)
    await target.locator(`[data-nation="${nationId}"]`).click()
    await target.locator('[data-action="join-match"]').click()
    await expect(target.getByTestId('multiplayer-lobby')).toContainText('Сбор в комнате')
  }

  try {
    await joinMatch(page, 'Alexios', 'porphyry')
    await joinMatch(secondPage, 'Kutlug', 'seljuk')
    await page.locator('[data-action="match-ready"]').click()
    await secondPage.locator('[data-action="match-ready"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-map-mode', 'realm')

    await page.getByTestId('voxel-world').click({ position: { x: 650, y: 515 } })
    await expect(page.getByTestId('campaign-target')).toContainText('Столица державы')
    await page.locator('[data-field="campaign-commitment"]').fill('75')
    await page.locator('[data-march-formation="wedge"]').click()
    await page.locator('[data-action="campaign-attack"]').click()
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-marches', '1')

    await expect(page.getByTestId('campaign-outcome')).toContainText('Победа в войне держав')
    await expect(secondPage.getByTestId('campaign-outcome')).toContainText('Матч завершён')
    await expect(secondPage.getByTestId('campaign-outcome')).toContainText('Фема Порфирополиса')
    await expect(page.getByTestId('voxel-world')).toHaveAttribute('data-campaign-winner', 'porphyry')
    await expect(secondPage.getByTestId('voxel-world')).toHaveAttribute('data-campaign-winner', 'porphyry')
    await expect(page.getByTestId('campaign-command-bar')).toHaveCount(0)
    await expect(secondPage.getByTestId('campaign-command-bar')).toHaveCount(0)
    await expect(page.getByTestId('mode-bar')).toHaveCount(0)
    await expect(secondPage.getByTestId('mode-bar')).toHaveCount(0)
    await expect(page.locator('[data-realm="seljuk"]')).toBeDisabled()
    await expect(page.getByTestId('notice')).toContainText('побеждает в матче')
    await expect(secondPage.getByTestId('notice')).toContainText('побеждает в матче')
    expect(errors).toEqual([])
  } finally {
    await secondContext.close()
    await matchServer.close()
  }
})

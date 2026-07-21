import {
  BUILDING_FOOTPRINTS,
  addressCrisis,
  advanceGame,
  createGame,
  demolishBuilding,
  dismissThreat,
  placeBuilding,
  placePath,
  repairBuilding,
  resolveRaid,
  revealThreat,
  settlementOutlook,
} from '../src/game/simulation'

describe('procedural valley', () => {
  it('recreates the same valley from the same seed', () => {
    const first = createGame('heather-17')
    const second = createGame('heather-17')

    expect(first.map).toEqual(second.map)
    expect(first.map.seed).toBe('heather-17')
    expect(first.map.forests.length).toBeGreaterThan(20)
    expect(first.map.fertileFields.length).toBeGreaterThan(10)
    expect(first.map.stoneDeposits.length).toBeGreaterThan(4)
  })

  it('changes the valley when the seed changes', () => {
    expect(createGame('north').map.forests).not.toEqual(createGame('south').map.forests)
  })
})

describe('settlement simulation', () => {
  it('starts from a real, editable urban nucleus rather than a painted backdrop', () => {
    const state = createGame('metropolis')
    const occupied = new Set(state.buildings.map((building) => `${building.x}:${building.y}`))

    expect(state.buildings.length).toBeGreaterThanOrEqual(28)
    expect(occupied.size).toBe(state.buildings.length)
    expect(state.buildings.filter((building) => building.kind === 'house').length).toBeGreaterThanOrEqual(8)
    expect(state.buildings.filter((building) => building.kind === 'wall').length).toBeGreaterThanOrEqual(4)
    expect(state.buildings.some((building) => building.kind === 'watchtower' && building.health < 100)).toBe(true)
  })

  it('lays out civic buildings with readable space between their full footprints', () => {
    const state = createGame('metropolis')
    const structures = state.buildings

    for (let leftIndex = 0; leftIndex < structures.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < structures.length; rightIndex += 1) {
        const left = structures[leftIndex]!
        const right = structures[rightIndex]!
        if ((left.kind === 'wall' && right.kind === 'watchtower') || (left.kind === 'watchtower' && right.kind === 'wall')) {
          const wall = left.kind === 'wall' ? left : right
          const tower = left.kind === 'watchtower' ? left : right
          const deltaX = Math.abs(wall.x - tower.x)
          const deltaY = Math.abs(wall.y - tower.y)
          if ((deltaX === 2 && deltaY <= 2) || (deltaY === 2 && deltaX <= 2)) continue
        }
        const [leftWidth, leftDepth] = BUILDING_FOOTPRINTS[left.kind]
        const [rightWidth, rightDepth] = BUILDING_FOOTPRINTS[right.kind]
        const linear = left.kind === 'road' || left.kind === 'wall' || right.kind === 'road' || right.kind === 'wall'
        const clearance = linear ? 0 : 1
        const separated = Math.abs(left.x - right.x) >= (leftWidth + rightWidth) / 2 + clearance
          || Math.abs(left.y - right.y) >= (leftDepth + rightDepth) / 2 + clearance
        expect(separated, `${left.kind}#${left.id} overlaps ${right.kind}#${right.id}`).toBe(true)
      }
    }
  })

  it('starts with continuous orthogonal wall sections rather than isolated slabs', () => {
    const state = createGame('fortifications')
    const walls = state.buildings.filter((building) => building.kind === 'wall')
    const cells = new Set(walls.map((wall) => `${wall.x}:${wall.y}`))

    expect(walls.length).toBeGreaterThan(80)
    for (const wall of walls) {
      const neighbours = [
        `${wall.x - 1}:${wall.y}`,
        `${wall.x + 1}:${wall.y}`,
        `${wall.x}:${wall.y - 1}`,
        `${wall.x}:${wall.y + 1}`,
      ]
      expect(neighbours.some((cell) => cells.has(cell)), `isolated wall at ${wall.x}:${wall.y}`).toBe(true)
    }
    for (const tower of state.buildings.filter((building) => building.kind === 'watchtower')) {
      const joinedFaces = walls.filter((wall) => {
        const deltaX = Math.abs(wall.x - tower.x)
        const deltaY = Math.abs(wall.y - tower.y)
        return (deltaX === 2 && deltaY <= 2) || (deltaY === 2 && deltaX <= 2)
      })
      expect(joinedFaces.length, `tower at ${tower.x}:${tower.y} is not joined to walls`).toBeGreaterThanOrEqual(2)
    }
  })

  it('places a building and charges its cost once', () => {
    const state = createGame('building')
    const result = placeBuilding(state, 'house', { x: 20, y: 24 })

    expect(result.ok).toBe(true)
    expect(state.resources.wood).toBe(112)
    expect(state.buildings.at(-1)).toMatchObject({ kind: 'house', x: 20, y: 24 })
  })

  it('rejects overlapping buildings without charging resources', () => {
    const state = createGame('building')
    placeBuilding(state, 'house', { x: 20, y: 24 })
    const woodAfterFirst = state.resources.wood

    const result = placeBuilding(state, 'granary', { x: 20, y: 24 })

    expect(result).toEqual({ ok: false, reason: 'Здесь уже стоит постройка' })
    expect(state.resources.wood).toBe(woodAfterFirst)
  })

  it('rejects a building whose footprint clips an existing structure', () => {
    const state = createGame('footprint')
    state.buildings = [state.buildings.find((building) => building.kind === 'townHall')!]
    const before = structuredClone(state)

    expect(placeBuilding(state, 'house', { x: 39, y: 31 })).toEqual({ ok: false, reason: 'Постройкам не хватает места' })
    expect(state).toEqual(before)
  })

  it('places a dragged road atomically and charges only accepted cells', () => {
    const state = createGame('road')
    const roadsBefore = state.buildings.filter((building) => building.kind === 'road').length
    const result = placePath(state, 'road', [{ x: 20, y: 3 }, { x: 21, y: 3 }, { x: 22, y: 3 }])

    expect(result).toEqual({ ok: true, placed: 3 })
    expect(state.buildings.filter((building) => building.kind === 'road')).toHaveLength(roadsBefore + 3)
    expect(state.resources.wood).toBe(117)
  })

  it('does not mutate a path when one cell is occupied', () => {
    const state = createGame('blocked-road')
    const before = structuredClone(state)
    const result = placePath(state, 'road', [{ x: 10, y: 10 }, { x: 32, y: 31 }])

    expect(result).toEqual({ ok: false, reason: 'Здесь уже стоит постройка' })
    expect(state).toEqual(before)
  })

  it('repairs a damaged building and charges only the missing share of materials', () => {
    const state = createGame('repair')
    const house = state.buildings.find((building) => building.kind === 'house')!
    house.health = 50

    const result = repairBuilding(state, house.id)

    expect(result).toEqual({ ok: true, cost: { wood: 4, stone: 0, silver: 0 } })
    expect(house.health).toBe(100)
    expect(state.resources.wood).toBe(116)
    expect(state.events.at(-1)?.title).toBe('Постройка восстановлена')
  })

  it('does not partially repair a building when materials are missing', () => {
    const state = createGame('failed-repair')
    const granary = state.buildings.find((building) => building.kind === 'granary')!
    granary.health = 25
    state.resources.wood = 0
    const before = structuredClone(state)

    expect(repairBuilding(state, granary.id)).toEqual({ ok: false, reason: 'Не хватает материалов для ремонта' })
    expect(state).toEqual(before)
  })

  it('demolishes a building and returns a modest salvage', () => {
    const state = createGame('demolition')
    const house = state.buildings.find((building) => building.kind === 'house')!

    const result = demolishBuilding(state, house.id)

    expect(result).toEqual({ ok: true, salvage: { wood: 2, stone: 0, silver: 0 } })
    expect(state.buildings.some((building) => building.id === house.id)).toBe(false)
    expect(state.resources.wood).toBe(122)
    expect(state.events.at(-1)?.title).toBe('Участок расчищен')
  })

  it('protects the main building from demolition without mutating state', () => {
    const state = createGame('protected-palace')
    const townHall = state.buildings.find((building) => building.kind === 'townHall')!
    const before = structuredClone(state)

    expect(demolishBuilding(state, townHall.id)).toEqual({ ok: false, reason: 'Главное здание нельзя разобрать' })
    expect(state).toEqual(before)
  })

  it('turns shortage into famine and disorder instead of a random popup', () => {
    const state = createGame('famine')
    state.resources.food = 0
    state.people = 120
    state.buildings.filter((building) => building.kind === 'farm').forEach((building) => { building.progress = 0 })

    advanceGame(state, 8)

    expect(state.crises.some((crisis) => crisis.kind === 'famine')).toBe(true)
    expect(state.order).toBeLessThan(72)
  })

  it('explains whether stores are growing or how many days remain', () => {
    const state = createGame('outlook')
    const secure = settlementOutlook(state)

    expect(secure.dailyFood).toBeGreaterThan(0)
    expect(secure.reserveDays).toBeNull()
    expect(secure.level).toBe('secure')

    state.people = 240
    state.resources.food = 90
    state.buildings.filter((building) => building.kind === 'farm').forEach((building) => { building.progress = 0 })
    const shortage = settlementOutlook(state)

    expect(shortage.dailyFood).toBeLessThan(0)
    expect(shortage.reserveDays).toBe(3)
    expect(shortage.level).toBe('critical')
  })

  it('lets the court fund famine relief with an explicit treasury cost', () => {
    const state = createGame('famine-relief')
    state.resources.food = 0
    state.crises.push({ id: 500, kind: 'famine', pressure: 30 })

    const result = addressCrisis(state, 500)

    expect(result).toEqual({ ok: true, resolved: false, summary: 'Закуплено зерно для городских раздач' })
    expect(state.resources).toMatchObject({ silver: 68, food: 480 })
    expect(state.order).toBe(76)
    expect(state.crises[0]?.pressure).toBe(6)
  })

  it('resolves a weakened crisis and records the political consequence', () => {
    const state = createGame('coup-oaths')
    state.crises.push({ id: 501, kind: 'coup', pressure: 20 })

    const result = addressCrisis(state, 501)

    expect(result).toMatchObject({ ok: true, resolved: true })
    expect(state.crises).toHaveLength(0)
    expect(state.legitimacy).toBe(78)
    expect(state.order).toBe(70)
    expect(state.events.at(-1)?.title).toBe('Кризис урегулирован')
  })

  it('does not partially mutate a crisis when the treasury cannot fund a response', () => {
    const state = createGame('empty-treasury')
    state.resources.silver = 0
    state.crises.push({ id: 502, kind: 'rebellion', pressure: 48 })
    const before = structuredClone(state)

    expect(addressCrisis(state, 502)).toEqual({ ok: false, reason: 'В казне недостаточно средств' })
    expect(state).toEqual(before)
  })

  it('offers a hardline crisis response with a political cost instead of a treasury cost', () => {
    const state = createGame('hardline')
    state.crises.push({ id: 503, kind: 'rebellion', pressure: 28 })

    const result = addressCrisis(state, 503, 'hardline')

    expect(result).toMatchObject({ ok: true, resolved: true })
    expect(state.resources.silver).toBe(92)
    expect(state.people).toBe(95)
    expect(state.legitimacy).toBe(59)
    expect(state.order).toBe(80)
  })

  it('lets an ignored coup become an actual change of regime', () => {
    const state = createGame('overthrow')
    state.legitimacy = 20
    state.order = 50
    state.crises.push({ id: 504, kind: 'coup', pressure: 96 })

    advanceGame(state)

    expect(state.crises.some((crisis) => crisis.kind === 'coup')).toBe(false)
    expect(state.legitimacy).toBe(35)
    expect(state.events.at(-1)?.title).toBe('Дворцовый переворот')
  })

  it('escalates low order into rebellion and low legitimacy into a coup', () => {
    const state = createGame('politics')
    state.order = 24
    state.legitimacy = 19

    advanceGame(state, 2)

    expect(state.crises).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'rebellion' }),
      expect.objectContaining({ kind: 'coup' }),
    ]))
    expect(state.events.some((event) => event.title === 'Бунт в посаде')).toBe(true)
    expect(state.events.some((event) => event.title === 'Заговор знати')).toBe(true)
  })
})

describe('dynamic threat director', () => {
  it('reveals uncertain intelligence before a raid enters the map', () => {
    const state = createGame('threat')
    const threat = revealThreat(state, 'raiders', 84)

    expect(threat.status).toBe('forming')
    expect(threat.intel).toBe('rumor')

    advanceGame(state, 3)

    expect(threat.status).toBe('approaching')
    expect(threat.intel).toBe('confirmed')
  })

  it('allows a threat to disappear without starting a scripted wave', () => {
    const state = createGame('threat')
    const threat = revealThreat(state, 'raiders', 42)

    dismissThreat(state, threat.id, 'supplies')

    expect(threat.status).toBe('disbanded')
    expect(state.events.at(-1)?.text).toContain('рассеялись')
    expect('nextWaveAt' in state).toBe(false)
  })

  it('lets an under-supplied external force disappear on its own', () => {
    const state = createGame('short-campaign')
    const threat = revealThreat(state, 'scouts', 28)
    threat.supplies = 8

    advanceGame(state)

    expect(threat.status).toBe('disbanded')
    expect(state.events.at(-1)?.title).toBe('Угроза миновала')
  })

  it('resolves visible combat through strength, defenses, and morale', () => {
    const state = createGame('battle')
    const threat = revealThreat(state, 'raiders', 84)
    advanceGame(state, 6)

    const result = resolveRaid(state, threat.id, 68)

    expect(result).toMatchObject({ outcome: 'victory', enemyLosses: 48, cityLosses: 9 })
    expect(result.damagedBuildingIds.length).toBeGreaterThan(0)
    expect(result.burningBuildingIds.length).toBe(1)
    expect(state.buildings.some((building) => result.damagedBuildingIds.includes(building.id) && building.health < 100)).toBe(true)
    expect(threat.status).toBe('withdrawing')
    expect(state.people).toBe(89)
    expect(state.events.at(-1)?.title).toBe('Налёт отбит')

    const afterBattle = structuredClone(state)
    expect(resolveRaid(state, threat.id, 68)).toMatchObject({ enemyLosses: 0, cityLosses: 0, damagedBuildingIds: [] })
    expect(state).toEqual(afterBattle)
  })
})

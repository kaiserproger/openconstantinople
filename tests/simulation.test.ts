import {
  advanceGame,
  createGame,
  dismissThreat,
  placeBuilding,
  placePath,
  resolveRaid,
  revealThreat,
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
  })

  it('places a building and charges its cost once', () => {
    const state = createGame('building')
    const result = placeBuilding(state, 'house', { x: 18, y: 22 })

    expect(result.ok).toBe(true)
    expect(state.resources.wood).toBe(112)
    expect(state.buildings.at(-1)).toMatchObject({ kind: 'house', x: 18, y: 22 })
  })

  it('rejects overlapping buildings without charging resources', () => {
    const state = createGame('building')
    placeBuilding(state, 'house', { x: 18, y: 22 })
    const woodAfterFirst = state.resources.wood

    const result = placeBuilding(state, 'granary', { x: 18, y: 22 })

    expect(result).toEqual({ ok: false, reason: 'Здесь уже стоит постройка' })
    expect(state.resources.wood).toBe(woodAfterFirst)
  })

  it('places a dragged road atomically and charges only accepted cells', () => {
    const state = createGame('road')
    const roadsBefore = state.buildings.filter((building) => building.kind === 'road').length
    const result = placePath(state, 'road', [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }])

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

  it('turns shortage into famine and disorder instead of a random popup', () => {
    const state = createGame('famine')
    state.resources.food = 0
    state.people = 120
    state.buildings.filter((building) => building.kind === 'farm').forEach((building) => { building.progress = 0 })

    advanceGame(state, 8)

    expect(state.crises.some((crisis) => crisis.kind === 'famine')).toBe(true)
    expect(state.order).toBeLessThan(72)
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

    expect(result).toEqual({ outcome: 'victory', enemyLosses: 48, cityLosses: 9 })
    expect(threat.status).toBe('withdrawing')
    expect(state.people).toBe(89)
    expect(state.events.at(-1)?.title).toBe('Налёт отбит')
  })
})

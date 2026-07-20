import {
  advanceGame,
  createGame,
  dismissThreat,
  placeBuilding,
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

  it('turns shortage into famine and disorder instead of a random popup', () => {
    const state = createGame('famine')
    state.resources.food = 0
    state.people = 120

    advanceGame(state, 8)

    expect(state.crises.some((crisis) => crisis.kind === 'famine')).toBe(true)
    expect(state.order).toBeLessThan(72)
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

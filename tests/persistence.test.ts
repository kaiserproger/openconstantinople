import { createGame, revealThreat } from '../src/game/simulation'
import { decodeSave, encodeSave, encodeVersionOneFixture } from '../src/game/persistence'

describe('versioned settlement saves', () => {
  it('round-trips the seed, tick, buildings, and living threats', () => {
    const state = createGame('saved-valley')
    state.tick = 1440
    revealThreat(state, 'raiders', 64)

    const restored = decodeSave(encodeSave(state))

    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.state.map.seed).toBe('saved-valley')
    expect(restored.state.tick).toBe(1440)
    expect(restored.state.buildings).toEqual(state.buildings)
    expect(restored.state.threats).toEqual(state.threats)
  })

  it('rejects corrupt data without crashing the game shell', () => {
    expect(decodeSave('{"version":1,"payload":"broken"}')).toEqual({
      ok: false,
      reason: 'Сохранение повреждено',
    })
  })

  it('round-trips the active preset and orthographic camera', () => {
    const payload = encodeSave(createGame('camera'), {
      presetId: 'byzantine-macedonian',
      camera: { targetX: 32, targetZ: 32, zoom: 1.25, quarter: 3 },
    })

    expect(decodeSave(payload)).toMatchObject({
      ok: true,
      meta: { presetId: 'byzantine-macedonian', camera: { zoom: 1.25, quarter: 3 } },
    })
  })

  it('migrates version one saves to the Byzantine preset and default camera', () => {
    const old = encodeVersionOneFixture(createGame('old'))

    expect(decodeSave(old)).toMatchObject({
      ok: true,
      meta: { presetId: 'byzantine-macedonian', camera: { zoom: 1, quarter: 0 } },
    })
  })
})

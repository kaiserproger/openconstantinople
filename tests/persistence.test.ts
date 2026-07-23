import { createGame, revealThreat } from '../src/game/simulation'
import {
  answerPeaceOffer,
  campaignArmySupplies,
  campaignRelation,
  realmEconomy,
  withdrawPeaceOffer,
} from '../src/game/campaign'
import {
  decodeSave,
  encodeSave,
  encodeVersionOneFixture,
  encodeVersionSevenFixture,
  encodeVersionThreeFixture,
} from '../src/game/persistence'

describe('versioned settlement saves', () => {
  it('round-trips the seed, tick, buildings, and living threats', () => {
    const state = createGame('saved-valley')
    state.tick = 1440
    revealThreat(state, 'raiders', 64)
    state.campaign.allianceOffers.push({
      fromRealmId: 'porphyry',
      toRealmId: 'bulgar',
      offeredAt: 3,
    })
    state.campaign.peaceOffers.push({
      fromRealmId: 'porphyry',
      toRealmId: 'seljuk',
      demandedProvinceId: null,
      offeredAt: 3,
    })
    const tradeSource = state.campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
    const tradeTarget = state.campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
    tradeSource.marketLevel = 1
    tradeTarget.owner = 'bulgar'
    tradeTarget.marketLevel = 1
    state.campaign.tradeRoutes.push({
      id: 'saved-caravan-road',
      realmIds: ['porphyry', 'bulgar'],
      provinceIds: [tradeSource.id, tradeTarget.id],
      openedAt: 3,
    })
    state.campaign.marches.push({
      id: 'saved-siege-column',
      kind: 'attack',
      siegeId: 'saved-siege',
      actorId: 'porphyry',
      sourceId: 42,
      targetId: 43,
      route: [42, 43],
      soldiers: 18,
      formation: 'shieldwall',
      supplies: 12,
      engines: 1,
      departedAt: 1000,
      arrivesAt: 4000,
    })
    state.campaign.marches.push({
      id: 'saved-routed-column',
      kind: 'attack',
      actorId: 'porphyry',
      sourceId: 56,
      targetId: 35,
      route: [56, 48, 40, 32, 33, 34, 35],
      soldiers: 24,
      formation: 'line',
      supplies: 8,
      engines: 0,
      departedAt: 1000,
      arrivesAt: 19000,
    })
    const siegeSource = state.campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const siegeTarget = state.campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    siegeTarget.owner = 'seljuk'
    siegeTarget.fortificationLevel = 1
    state.campaign.sieges.push({
      id: 'saved-siege',
      attackerId: 'porphyry',
      defenderId: 'seljuk',
      sourceId: siegeSource.id,
      targetId: siegeTarget.id,
      soldiers: 44,
      formation: 'wedge',
      tactic: 'sappers',
      progress: 38,
      supplies: 9,
      engines: 2,
      startedAt: 2,
      lastResolvedAt: 3,
    })

    const restored = decodeSave(encodeSave(state))

    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.state.map.seed).toBe('saved-valley')
    expect(restored.state.tick).toBe(1440)
    expect(restored.state.buildings).toEqual(state.buildings)
    expect(restored.state.threats).toEqual(state.threats)
    expect(restored.state.campaign).toEqual(state.campaign)
    expect(restored.state.campaign.marches.find((march) => march.id === 'saved-routed-column')?.route).toEqual([
      56, 48, 40, 32, 33, 34, 35,
    ])
    expect(withdrawPeaceOffer(restored.state.campaign, 'seljuk', 'porphyry')).toMatchObject({ ok: true })
    expect(restored.state.campaign.peaceOffers).toEqual([])
  })

  it('can resolve an incoming peace offer after an offline restore', () => {
    const state = createGame('restored-peace')
    state.campaign.peaceOffers.push({
      fromRealmId: 'seljuk',
      toRealmId: 'porphyry',
      demandedProvinceId: null,
      offeredAt: 2,
    })

    const restored = decodeSave(encodeSave(state))

    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(answerPeaceOffer(restored.state.campaign, 'seljuk', true, 'porphyry')).toMatchObject({
      ok: true,
      message: expect.stringContaining('белый мир'),
    })
    expect(campaignRelation(restored.state.campaign, 'seljuk', 'porphyry')?.status).toBe('truce')
    expect(restored.state.campaign.peaceOffers).toEqual([])
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

    const migrated = decodeSave(old)
    expect(migrated).toMatchObject({
      ok: true,
      meta: { presetId: 'byzantine-macedonian', camera: { zoom: 1, quarter: 0 } },
    })
    if (migrated.ok) {
      expect(migrated.state.campaign.provinces).toHaveLength(64)
      expect(migrated.state.campaign.provinces.every((province) => province.workshopLevel === 0)).toBe(true)
      expect(migrated.state.campaign.provinces.every((province) => province.homelandOf !== undefined)).toBe(true)
    }
  })

  it('migrates version three campaign rulers and diplomacy without losing provinces', () => {
    const state = createGame('old-campaign')
    state.campaign.provinces[0].levies = 77
    const legacySource = state.campaign.provinces.find((province) => province.id === 34)!
    state.campaign.marches.push({
      id: 'legacy-march',
      kind: 'attack',
      actorId: 'porphyry',
      sourceId: 34,
      targetId: 35,
      route: [34, 35],
      soldiers: 20,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })
    const old = encodeVersionThreeFixture(state)

    const migrated = decodeSave(old)

    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.state.campaign.provinces[0].levies).toBe(77)
    expect(migrated.state.campaign.marches[0]?.kind).toBe('attack')
    expect(migrated.state.campaign.marches[0]?.supplies).toBe(campaignArmySupplies(legacySource))
    expect(migrated.state.campaign.realms.find((realm) => realm.id === 'seljuk')?.ruler).toMatchObject({
      name: 'Кутлуг-бей',
      dynasty: 'Кынык',
    })
    expect(campaignRelation(migrated.state.campaign, 'seljuk')).toMatchObject({ status: 'war', opinion: -65 })
    expect(campaignRelation(migrated.state.campaign, 'seljuk')?.tradeEmbargoes).toEqual([])
    expect(realmEconomy(migrated.state.campaign, 'porphyry')).toMatchObject({ silver: 92, legitimacy: 68 })
    expect(migrated.state.campaign.tradeRoutes).toEqual([])
    expect(migrated.state.campaign.sieges).toEqual([])
    expect(migrated.state.campaign.provinces.find((province) => province.owner === 'porphyry')?.defenseFormation).toBe('shieldwall')
    expect(migrated.state.campaign.provinces.find((province) => province.owner === 'seljuk')?.defenseFormation).toBe('wedge')
    expect(migrated.state.campaign.provinces.find((province) => province.owner === null)?.defenseFormation).toBe('line')
    expect(migrated.state.campaign.realms.every((realm) => (
      realm.status === 'active' && realm.defeatedAt === null && realm.defeatedBy === null
    ))).toBe(true)
    expect(migrated.state.campaign.provinces.filter((province) => province.capitalOf)).toHaveLength(3)
    expect(migrated.state.campaign.winnerRealmId).toBeNull()
    expect(migrated.state.campaign.allianceOffers).toEqual([])
    expect(migrated.state.campaign.marches).toContainEqual(expect.objectContaining({
      id: 'legacy-march',
      formation: 'line',
      route: [34, 35],
    }))
  })

  it('migrates version seven city levels into explicit medieval holdings', () => {
    const state = createGame('legacy-holdings')
    const province = state.campaign.provinces.find((item) => item.owner === 'porphyry')!
    province.cityLevel = 1
    const old = encodeVersionSevenFixture(state)

    const migrated = decodeSave(old)

    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.state.campaign.provinces.find((item) => item.id === province.id)).toMatchObject({
      cityLevel: 1,
      marketLevel: 0,
      fortificationLevel: 1,
      project: null,
    })
  })
})

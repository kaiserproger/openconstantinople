import {
  answerAllianceOffer,
  answerPeaceOffer,
  beginSiegeMarch,
  CAMPAIGN_MUSTER_COST,
  CAMPAIGN_CAPITAL_LOOT,
  PROVINCE_PROJECTS,
  advanceCampaign,
  attackProvince,
  beginAllianceSupportMarch,
  beginCampaignMarch,
  breakAlliance,
  campaignActionBlockReason,
  campaignMarchRoute,
  campaignSiegeProjectedDailyProgress,
  campaignRelation,
  campaignPeaceDemandCandidates,
  campaignWarScore,
  campaignProvinceAt,
  createCampaign,
  declareWar,
  executeSiegeManeuver,
  formAlliance,
  musterProvince,
  offerTruce,
  offerAlliance,
  proposePeace,
  openTradeRoute,
  provincesAreAdjacent,
  provinceLevyCap,
  recallCampaignMarch,
  realmProvinceCount,
  realmDailyIncome,
  realmEconomy,
  realmStrength,
  reinforceAllianceProvince,
  resolveCampaignMarches,
  retreatSiege,
  sendAllianceSilver,
  sendGift,
  setSiegeTactic,
  setTradeEmbargo,
  setProvinceDefenseFormation,
  startProvinceProject,
  sortieSiege,
  tradeRouteIncome,
  withdrawPeaceOffer,
} from '../src/game/campaign'
import { NATIONS, type NationDefinition } from '../src/game/nations'

describe('medieval territory campaign', () => {
  it('builds the same contiguous 8 by 8 realm map from the same seed', () => {
    const first = createCampaign('heather-17')
    const second = createCampaign('heather-17')

    expect(first).toEqual(second)
    expect(first.provinces).toHaveLength(64)
    expect(realmProvinceCount(first, 'porphyry')).toBeGreaterThan(8)
    expect(first.provinces.some((province) => province.owner === null)).toBe(true)
    expect(campaignProvinceAt(first, { x: 17, y: 41 })?.owner).toBe('porphyry')
    expect(first.realms.find((realm) => realm.id === 'seljuk')?.ruler).toMatchObject({
      dynasty: 'Кынык',
      martial: 14,
      trait: 'Неутомимый завоеватель',
    })
    expect(campaignRelation(first, 'seljuk')?.status).toBe('war')
    expect(campaignRelation(first, 'bulgar')?.status).toBe('neutral')
    expect(first.realms.every((realm) => realm.status === 'active')).toBe(true)
    expect(first.provinces.filter((province) => province.capitalOf)).toHaveLength(3)
    expect(first.provinces.find((province) => province.capitalOf === 'porphyry')).toMatchObject({
      owner: 'porphyry',
      cityLevel: 2,
      marketLevel: 1,
      fortificationLevel: 1,
      project: null,
    })
    expect(first.winnerRealmId).toBeNull()
  })

  it('builds realms from a nation catalog instead of a closed id union', () => {
    const customNation: NationDefinition = {
      id: 'armenian',
      name: 'Армянское княжество',
      shortName: 'Армения',
      mapStyle: 'danubian',
      ruler: {
        name: 'Ашот',
        dynasty: 'Багратуни',
        age: 36,
        martial: 10,
        diplomacy: 12,
        stewardship: 11,
        trait: 'Хранитель перевалов',
      },
      startingArea: { columns: [3, 4], rows: [0, 1] },
      capital: { column: 3, row: 0 },
    }
    const campaign = createCampaign('custom-nations', [NATIONS[0], customNation])

    expect(campaign.realms.map((realm) => realm.id)).toEqual(['porphyry', 'armenian'])
    expect(realmProvinceCount(campaign, 'armenian')).toBe(4)
    expect(campaignRelation(campaign, 'armenian')).toMatchObject({ status: 'neutral' })
  })

  it('captures only an adjacent province by committing a real share of local levies', () => {
    const campaign = createCampaign('conquest')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 80
    target.levies = 12
    const before = realmProvinceCount(campaign, 'porphyry')

    expect(provincesAreAdjacent(source, target)).toBe(true)
    expect(attackProvince(campaign, source.id, target.id, 50)).toMatchObject({ ok: true, outcome: 'captured', committed: 40 })
    expect(source.levies).toBe(40)
    expect(target.owner).toBe('porphyry')
    expect(realmProvinceCount(campaign, 'porphyry')).toBe(before + 1)
  })

  it('reserves levies for a timed march and resolves the border only on arrival', () => {
    const campaign = createCampaign('timed-march')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 80
    target.levies = 12

    const order = beginCampaignMarch(campaign, {
      id: 'march-1',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })

    expect(order).toMatchObject({ ok: true, march: { soldiers: 40, formation: 'wedge' } })
    expect(source.levies).toBe(40)
    expect(target.owner).toBe(null)
    expect(resolveCampaignMarches(campaign, 3999)).toEqual([])
    expect(campaign.marches).toHaveLength(1)

    expect(resolveCampaignMarches(campaign, 4000)).toContainEqual(expect.objectContaining({
      outcome: 'captured',
      targetId: target.id,
    }))
    expect(target.owner).toBe('porphyry')
    expect(campaign.marches).toEqual([])
  })

  it('accepts a precise five-point march share and rejects values outside the contract', () => {
    const campaign = createCampaign('precise-commitment')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 100
    target.levies = 12

    expect(beginCampaignMarch(campaign, {
      id: 'invalid-commitment',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 52,
      formation: 'line',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toEqual({
      ok: false,
      reason: 'Доля похода должна быть от 10 до 90% с шагом 5%',
    })
    expect(source.levies).toBe(100)

    expect(beginCampaignMarch(campaign, {
      id: 'precise-commitment',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 65,
      formation: 'line',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({
      ok: true,
      march: { soldiers: 65 },
    })
    expect(source.levies).toBe(35)
  })

  it('routes a distant attack through owned provinces and prices every transition in time', () => {
    const campaign = createCampaign('routed-march')
    const source = campaign.provinces.find((province) => province.column === 0 && province.row === 7)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 80
    target.levies = 12

    expect(campaignMarchRoute(campaign, source.id, target.id, 'porphyry')).toEqual([
      56, 48, 40, 32, 33, 34, 35,
    ])
    const order = beginCampaignMarch(campaign, {
      id: 'long-column',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'shieldwall',
      departedAt: 1000,
      arrivesAt: 4000,
    })

    expect(order).toMatchObject({
      ok: true,
      march: {
        route: [56, 48, 40, 32, 33, 34, 35],
        departedAt: 1000,
        arrivesAt: 19000,
      },
    })
    expect(resolveCampaignMarches(campaign, 18999)).toEqual([])
    expect(resolveCampaignMarches(campaign, 19000)).toContainEqual(expect.objectContaining({
      marchId: 'long-column',
      outcome: 'captured',
      targetId: target.id,
    }))
  })

  it('rejects a distant attack when no owned corridor reaches its frontier', () => {
    const campaign = createCampaign('blocked-route')
    const source = campaign.provinces.find((province) => province.column === 0 && province.row === 7)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    for (const province of campaign.provinces) {
      if (province.id !== source.id) province.owner = null
    }
    source.levies = 80

    expect(campaignMarchRoute(campaign, source.id, target.id, 'porphyry')).toBeNull()
    expect(beginCampaignMarch(campaign, {
      id: 'blocked-column',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'line',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toEqual({ ok: false, reason: 'К цели нет пути через ваши земли' })
    expect(source.levies).toBe(80)
  })

  it('intercepts hostile columns that reach the same route node together', () => {
    const campaign = createCampaign('route-interception')
    const porphyrySource = campaign.provinces.find((province) => province.id === 56)!
    const seljukSource = campaign.provinces.find((province) => province.id === 36)!
    const porphyryFront = campaign.provinces.find((province) => province.id === 34)!
    const seljukFront = campaign.provinces.find((province) => province.id === 35)!
    porphyrySource.levies = 80
    seljukSource.owner = 'seljuk'
    seljukSource.levies = 80
    seljukFront.owner = 'seljuk'
    seljukFront.levies = 20

    expect(beginCampaignMarch(campaign, {
      id: 'porphyry-column',
      actorId: 'porphyry',
      sourceId: porphyrySource.id,
      targetId: seljukFront.id,
      commitmentPercent: 50,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({
      ok: true,
      march: { route: [56, 48, 40, 32, 33, 34, 35], arrivesAt: 19000 },
    })
    expect(beginCampaignMarch(campaign, {
      id: 'seljuk-column',
      actorId: 'seljuk',
      sourceId: seljukSource.id,
      targetId: porphyryFront.id,
      commitmentPercent: 50,
      formation: 'line',
      departedAt: 10000,
      arrivesAt: 13000,
    })).toMatchObject({
      ok: true,
      march: { route: [36, 35, 34], arrivesAt: 16000 },
    })

    expect(resolveCampaignMarches(campaign, 15999)).toEqual([])
    const reports = resolveCampaignMarches(campaign, 16000)

    expect(reports).toHaveLength(2)
    expect(reports.every((report) => report.outcome === 'intercepted')).toBe(true)
    expect(reports.every((report) => report.targetId === porphyryFront.id)).toBe(true)
    expect(campaign.marches).toEqual([])
    expect(porphyryFront.owner).toBe('porphyry')
    expect(seljukFront.owner).toBe('seljuk')
  })

  it('returns a marching army when diplomacy makes its destination peaceful', () => {
    const campaign = createCampaign('peaceful-arrival')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 3)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 3)!
    target.owner = 'seljuk'
    source.levies = 80
    expect(beginCampaignMarch(campaign, {
      id: 'march-peace',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'line',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({ ok: true })
    expect(offerTruce(campaign, 'seljuk')).toMatchObject({ ok: true })

    expect(resolveCampaignMarches(campaign, 4000)).toContainEqual(expect.objectContaining({ outcome: 'cancelled' }))
    expect(source.levies).toBe(80)
    expect(target.owner).toBe('seljuk')
  })

  it('recalls an unfinished march with the OpenFront retreat loss', () => {
    const campaign = createCampaign('recalled-march')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 80
    target.levies = 12
    expect(beginCampaignMarch(campaign, {
      id: 'march-recall',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({ ok: true, march: { soldiers: 40 } })

    expect(recallCampaignMarch(campaign, 'march-recall', 'porphyry')).toEqual({
      ok: true,
      message: `${source.name}: поход отозван · вернулись 30, потери 10`,
    })
    expect(source.levies).toBe(70)
    expect(target.owner).toBe(null)
    expect(campaign.marches).toEqual([])
    expect(resolveCampaignMarches(campaign, 4000)).toEqual([])
  })

  it('returns every simultaneous march resolution in deterministic order', () => {
    const campaign = createCampaign('simultaneous-marches')
    const pairs = [
      [
        campaign.provinces.find((province) => province.column === 2 && province.row === 4)!,
        campaign.provinces.find((province) => province.column === 3 && province.row === 4)!,
      ],
      [
        campaign.provinces.find((province) => province.column === 2 && province.row === 5)!,
        campaign.provinces.find((province) => province.column === 3 && province.row === 5)!,
      ],
    ] as const
    pairs.forEach(([source, target], index) => {
      source.levies = 80
      target.levies = 12
      expect(beginCampaignMarch(campaign, {
        id: `march-${index}`,
        actorId: 'porphyry',
        sourceId: source.id,
        targetId: target.id,
        commitmentPercent: 50,
        formation: 'line',
        departedAt: 1000,
        arrivesAt: 4000,
      })).toMatchObject({ ok: true })
    })

    const reports = resolveCampaignMarches(campaign, 4000)

    expect(reports).toHaveLength(2)
    expect(reports.map((report) => report.marchId)).toEqual(['march-0', 'march-1'])
    expect(reports.every((report) => report.outcome === 'captured')).toBe(true)
  })

  it('orders simultaneous attacks on one province by stable battle fields instead of random ids', () => {
    const campaign = createCampaign('same-target-marches')
    const porphyrySource = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const seljukSource = campaign.provinces.find((province) => province.column === 4 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    porphyrySource.levies = 80
    seljukSource.owner = 'seljuk'
    seljukSource.levies = 80
    target.owner = null
    target.levies = 12
    target.defenseFormation = 'line'

    expect(beginCampaignMarch(campaign, {
      id: 'z-random-looking-id',
      actorId: 'porphyry',
      sourceId: porphyrySource.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'line',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({ ok: true })
    expect(beginCampaignMarch(campaign, {
      id: 'a-random-looking-id',
      actorId: 'seljuk',
      sourceId: seljukSource.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({ ok: true })

    const reports = resolveCampaignMarches(campaign, 4000)

    expect(reports.map((report) => report.actorId)).toEqual(['porphyry', 'seljuk'])
    expect(reports.map((report) => report.marchId)).toEqual(['z-random-looking-id', 'a-random-looking-id'])
  })

  it('rejects remote attacks without mutating armies', () => {
    const campaign = createCampaign('frontier')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 5 && province.row === 4)!
    const before = structuredClone(campaign)

    expect(attackProvince(campaign, source.id, target.id, 75)).toEqual({ ok: false, reason: 'Для похода нужна общая граница' })
    expect(campaign).toEqual(before)
  })

  it('requires war before attacking a neighboring sovereign realm', () => {
    const campaign = createCampaign('frontier-law')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    target.owner = 'bulgar'
    const before = structuredClone(campaign)

    expect(attackProvince(campaign, source.id, target.id, 75)).toEqual({
      ok: false,
      reason: 'Для похода на державу сначала объявите войну',
    })
    expect(campaign).toEqual(before)
    expect(declareWar(campaign, 'bulgar')).toMatchObject({ ok: true })
    expect(attackProvince(campaign, source.id, target.id, 75)).toMatchObject({ ok: true })
  })

  it('turns gifts into an alliance and supports an explicit break', () => {
    const campaign = createCampaign('diplomacy')

    expect(formAlliance(campaign, 'bulgar')).toEqual({ ok: false, reason: 'Для союза нужно отношение не ниже 50' })
    expect(sendGift(campaign, 'bulgar')).toMatchObject({ ok: true })
    expect(sendGift(campaign, 'bulgar')).toMatchObject({ ok: true })
    expect(campaignRelation(campaign, 'bulgar')?.opinion).toBe(60)
    expect(formAlliance(campaign, 'bulgar')).toMatchObject({ ok: true })
    expect(campaignRelation(campaign, 'bulgar')?.status).toBe('alliance')
    expect(breakAlliance(campaign, 'bulgar')).toMatchObject({ ok: true })
    expect(campaignRelation(campaign, 'bulgar')).toMatchObject({
      status: 'neutral',
      opinion: 30,
      tradeEmbargoes: ['porphyry'],
    })
  })

  it('keeps a proposed alliance neutral until the invited ruler answers', () => {
    const campaign = createCampaign('bilateral-alliance')
    expect(sendGift(campaign, 'bulgar')).toMatchObject({ ok: true })
    expect(sendGift(campaign, 'bulgar')).toMatchObject({ ok: true })

    expect(offerAlliance(campaign, 'bulgar', 'porphyry')).toMatchObject({
      ok: true,
      message: expect.stringContaining('предлагает союз'),
    })
    expect(campaignRelation(campaign, 'bulgar', 'porphyry')?.status).toBe('neutral')
    expect(campaign.allianceOffers).toEqual([{
      fromRealmId: 'porphyry',
      toRealmId: 'bulgar',
      offeredAt: 0,
    }])
    expect(answerAllianceOffer(campaign, 'porphyry', true, 'seljuk')).toEqual({
      ok: false,
      reason: 'Входящее предложение союза не найдено',
    })

    expect(answerAllianceOffer(campaign, 'porphyry', true, 'bulgar')).toMatchObject({
      ok: true,
      message: expect.stringContaining('принимает союз'),
    })
    expect(campaignRelation(campaign, 'bulgar', 'porphyry')?.status).toBe('alliance')
    expect(campaign.allianceOffers).toEqual([])
  })

  it('lets the invited ruler decline without changing the neutral relation', () => {
    const campaign = createCampaign('declined-alliance')
    const relation = campaignRelation(campaign, 'bulgar', 'porphyry')!
    relation.opinion = 55
    expect(offerAlliance(campaign, 'bulgar', 'porphyry')).toMatchObject({ ok: true })

    expect(answerAllianceOffer(campaign, 'porphyry', false, 'bulgar')).toEqual({
      ok: true,
      message: 'Предложение союза отклонено',
    })
    expect(relation.status).toBe('neutral')
    expect(relation.opinion).toBe(55)
    expect(campaign.allianceOffers).toEqual([])
  })

  it('keeps a white peace proposal pending until the opposing ruler answers', () => {
    const campaign = createCampaign('bilateral-peace')

    expect(proposePeace(campaign, 'seljuk', null, 'porphyry')).toMatchObject({
      ok: true,
      message: expect.stringContaining('белый мир'),
    })
    expect(campaignRelation(campaign, 'seljuk', 'porphyry')?.status).toBe('war')
    expect(campaign.peaceOffers).toEqual([{
      fromRealmId: 'porphyry',
      toRealmId: 'seljuk',
      demandedProvinceId: null,
      offeredAt: 0,
    }])
    expect(answerPeaceOffer(campaign, 'porphyry', false, 'seljuk')).toEqual({
      ok: true,
      message: 'Мирные условия отклонены',
    })
    expect(campaignRelation(campaign, 'seljuk', 'porphyry')?.status).toBe('war')

    expect(proposePeace(campaign, 'seljuk', null, 'porphyry')).toMatchObject({ ok: true })
    expect(withdrawPeaceOffer(campaign, 'seljuk', 'porphyry')).toEqual({
      ok: true,
      message: 'Мирное посольство отозвано',
    })
    expect(campaign.peaceOffers).toEqual([])

    expect(proposePeace(campaign, 'seljuk', null, 'porphyry')).toMatchObject({ ok: true })
    expect(answerPeaceOffer(campaign, 'porphyry', true, 'seljuk')).toMatchObject({
      ok: true,
      message: expect.stringContaining('белый мир'),
    })
    expect(campaignRelation(campaign, 'seljuk', 'porphyry')).toMatchObject({
      status: 'truce',
      truceUntil: 12,
    })
    expect(campaign.peaceOffers).toEqual([])
  })

  it('allows one border province demand only after a decisive war score', () => {
    const campaign = createCampaign('territorial-peace')
    const candidate = campaign.provinces.find((province) => (
      province.owner === 'seljuk'
      && province.capitalOf !== 'seljuk'
      && campaign.provinces.some((neighbor) => (
        neighbor.owner !== 'seljuk' && provincesAreAdjacent(neighbor, province)
      ))
    ))!
    const bridge = campaign.provinces.find((province) => (
      province.owner !== 'seljuk' && provincesAreAdjacent(province, candidate)
    ))!
    bridge.owner = 'porphyry'

    expect(proposePeace(campaign, 'seljuk', candidate.id, 'porphyry')).toEqual({
      ok: false,
      reason: 'Для территориального требования нужен военный счёт 40',
    })

    for (const province of campaign.provinces) {
      if (
        province.homelandOf === 'seljuk'
        && province.id !== candidate.id
        && province.capitalOf !== 'seljuk'
      ) province.owner = 'porphyry'
    }
    expect(campaignWarScore(campaign, 'seljuk', 'porphyry')).toBeGreaterThanOrEqual(40)
    expect(campaignPeaceDemandCandidates(campaign, 'seljuk', 'porphyry')).toContain(candidate)
    expect(proposePeace(campaign, 'seljuk', candidate.id, 'porphyry')).toMatchObject({ ok: true })
    expect(answerPeaceOffer(campaign, 'porphyry', true, 'seljuk')).toMatchObject({
      ok: true,
      message: expect.stringContaining(candidate.name),
    })
    expect(candidate.owner).toBe('porphyry')
    expect(campaignRelation(campaign, 'seljuk', 'porphyry')?.status).toBe('truce')
  })

  it('moves treasury silver and provincial levies only between allies', () => {
    const campaign = createCampaign('alliance-aid')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
    target.owner = 'bulgar'
    source.levies = 80
    target.levies = 20

    expect(sendAllianceSilver(campaign, 'bulgar', 15, 'porphyry')).toEqual({
      ok: false,
      reason: 'Помощь казной доступна только союзнику',
    })
    const relation = campaignRelation(campaign, 'bulgar', 'porphyry')!
    relation.status = 'alliance'
    relation.opinion = 70

    expect(sendAllianceSilver(campaign, 'bulgar', 30, 'porphyry')).toMatchObject({ ok: true })
    expect(realmEconomy(campaign, 'porphyry')?.silver).toBe(62)
    expect(realmEconomy(campaign, 'bulgar')?.silver).toBe(122)
    expect(reinforceAllianceProvince(campaign, source.id, target.id, 25, 'porphyry')).toMatchObject({ ok: true })
    expect(source.levies).toBe(60)
    expect(target.levies).toBe(40)
  })

  it('marches allied reinforcements to the selected border and returns them if the pact breaks', () => {
    const campaign = createCampaign('alliance-relief-column')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
    target.owner = 'bulgar'
    source.levies = 80
    target.levies = 20
    campaignRelation(campaign, 'bulgar', 'porphyry')!.status = 'alliance'

    const order = beginAllianceSupportMarch(campaign, {
      id: 'relief-column',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'shieldwall',
      departedAt: 1000,
      arrivesAt: 4000,
    })
    expect(order).toMatchObject({
      ok: true,
      march: { kind: 'support', soldiers: 40, targetId: target.id },
    })
    expect(source.levies).toBe(40)
    expect(resolveCampaignMarches(campaign, 4000)).toContainEqual(expect.objectContaining({
      outcome: 'reinforced',
      message: expect.stringContaining('присылает 40 ратников'),
    }))
    expect(target.levies).toBe(60)

    const returnOrder = beginAllianceSupportMarch(campaign, {
      id: 'broken-oath-column',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'line',
      departedAt: 5000,
      arrivesAt: 8000,
    })
    expect(returnOrder).toMatchObject({ ok: true })
    const sourceAfterDeparture = source.levies
    expect(breakAlliance(campaign, 'bulgar', 'porphyry')).toMatchObject({ ok: true })
    expect(resolveCampaignMarches(campaign, 8000)).toContainEqual(expect.objectContaining({
      outcome: 'cancelled',
      message: expect.stringContaining('союз больше не действует'),
    }))
    expect(source.levies).toBeGreaterThan(sourceAfterDeparture)
    expect(target.levies).toBe(60)
  })

  it('pays both market realms until one ruler imposes a trade embargo', () => {
    const campaign = createCampaign('border-market')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
    source.marketLevel = 1
    target.owner = 'bulgar'
    target.marketLevel = 1
    const porphyryIncomeBefore = realmDailyIncome(campaign, 'porphyry')
    const bulgarIncomeBefore = realmDailyIncome(campaign, 'bulgar')

    expect(openTradeRoute(campaign, source.id, target.id, 'porphyry', 'border-caravan')).toMatchObject({
      ok: true,
      message: expect.stringContaining('+6 каждой казне'),
    })
    expect(campaign.tradeRoutes).toEqual([{
      id: 'border-caravan',
      realmIds: ['porphyry', 'bulgar'],
      provinceIds: [source.id, target.id],
      openedAt: 0,
    }])
    expect(tradeRouteIncome(campaign, campaign.tradeRoutes[0])).toBe(6)
    expect(realmDailyIncome(campaign, 'porphyry')).toBe(porphyryIncomeBefore + 6)
    expect(realmDailyIncome(campaign, 'bulgar')).toBe(bulgarIncomeBefore + 6)

    const porphyrySilver = realmEconomy(campaign, 'porphyry')!.silver
    const bulgarSilver = realmEconomy(campaign, 'bulgar')!.silver
    advanceCampaign(campaign, 1, { aiExpansion: false })
    expect(realmEconomy(campaign, 'porphyry')?.silver).toBe(porphyrySilver + porphyryIncomeBefore + 6)
    expect(realmEconomy(campaign, 'bulgar')?.silver).toBe(bulgarSilver + bulgarIncomeBefore + 6)

    expect(setTradeEmbargo(campaign, 'porphyry', true, 'bulgar')).toMatchObject({ ok: true })
    expect(campaign.tradeRoutes).toEqual([])
    expect(campaignRelation(campaign, 'bulgar', 'porphyry')?.tradeEmbargoes).toEqual(['bulgar'])
    expect(openTradeRoute(campaign, source.id, target.id, 'porphyry')).toEqual({
      ok: false,
      reason: 'Торговлю блокирует эмбарго',
    })
    expect(setTradeEmbargo(campaign, 'bulgar', false, 'porphyry')).toEqual({
      ok: false,
      reason: 'Вашего эмбарго нет',
    })
    expect(setTradeEmbargo(campaign, 'porphyry', false, 'bulgar')).toMatchObject({ ok: true })
    expect(openTradeRoute(campaign, source.id, target.id, 'porphyry', 'restored-caravan')).toMatchObject({ ok: true })
    expect(declareWar(campaign, 'bulgar', 'porphyry')).toMatchObject({ ok: true })
    expect(campaign.tradeRoutes).toEqual([])
  })

  it('expires a negotiated truce on the campaign clock', () => {
    const campaign = createCampaign('truce')

    expect(offerTruce(campaign, 'seljuk')).toMatchObject({ ok: true })
    expect(campaignRelation(campaign, 'seljuk')).toMatchObject({ status: 'truce', truceUntil: 12 })
    const reports = advanceCampaign(campaign, 12)

    expect(campaignRelation(campaign, 'seljuk')).toMatchObject({ status: 'neutral', truceUntil: null })
    expect(reports).toContainEqual(expect.objectContaining({ kind: 'truce-ended', actorId: 'seljuk' }))
  })

  it('lets rival rulers expand into neutral borderlands on deterministic turns', () => {
    const campaign = createCampaign('rival-march')
    const seljukBefore = realmProvinceCount(campaign, 'seljuk')
    const bulgarBefore = realmProvinceCount(campaign, 'bulgar')
    const strengthBefore = realmStrength(campaign, 'seljuk')

    const departures = advanceCampaign(campaign, 4)

    expect(realmProvinceCount(campaign, 'seljuk')).toBe(seljukBefore)
    expect(realmProvinceCount(campaign, 'bulgar')).toBe(bulgarBefore)
    expect(campaign.marches).toHaveLength(2)
    expect(campaign.marches.every((march) => march.route.length >= 2 && march.arrivesAt > march.departedAt)).toBe(true)
    expect(departures.filter((report) => report.kind === 'march-started')).toHaveLength(2)

    const arrivals = advanceCampaign(campaign, 1)
    expect(realmProvinceCount(campaign, 'seljuk')).toBe(seljukBefore + 1)
    expect(realmProvinceCount(campaign, 'bulgar')).toBe(bulgarBefore + 1)
    expect(realmStrength(campaign, 'seljuk')).not.toBe(strengthBefore)
    expect(arrivals.filter((report) => report.kind === 'conquest')).toHaveLength(2)
    expect(campaign.marches).toEqual([])
  })

  it('raises provincial levies on the campaign clock without exceeding the cap', () => {
    const campaign = createCampaign('levies')
    const capital = campaign.provinces.find((province) => province.cityLevel === 2 && province.owner === 'porphyry')!
    const before = capital.levies

    advanceCampaign(campaign, 3)

    expect(capital.levies).toBe(before + 4)
  })

  it('turns controlled land into national income on the deterministic campaign clock', () => {
    const campaign = createCampaign('national-income')
    const economy = realmEconomy(campaign, 'porphyry')!
    const dailyIncome = realmDailyIncome(campaign, 'porphyry')

    advanceCampaign(campaign, 2, { aiExpansion: false })

    expect(campaign.tick).toBe(2)
    expect(economy.silver).toBe(92 + dailyIncome * 2)
  })

  it('builds one provincial project at a time and applies its economy after two days', () => {
    const campaign = createCampaign('province-management')
    const province = campaign.provinces.find((item) => item.owner === 'porphyry' && item.cityLevel === 0)!
    const foreign = campaign.provinces.find((item) => item.owner === 'seljuk')!
    const economy = realmEconomy(campaign, 'porphyry')!
    const initialLevies = province.levies
    const initialIncome = realmDailyIncome(campaign, 'porphyry')
    const foreignBefore = structuredClone(foreign)

    expect(musterProvince(campaign, province.id, 'porphyry')).toMatchObject({ ok: true })
    expect(province.levies).toBe(initialLevies + 12)
    expect(economy.silver).toBe(92 - CAMPAIGN_MUSTER_COST)

    expect(startProvinceProject(campaign, province.id, 'settlement', 'porphyry')).toMatchObject({ ok: true })
    expect(province).toMatchObject({
      cityLevel: 0,
      project: { kind: 'settlement', startedAt: 0, completesAt: 2 },
    })
    expect(economy.silver).toBe(92 - CAMPAIGN_MUSTER_COST - PROVINCE_PROJECTS.settlement.cost)
    expect(startProvinceProject(campaign, province.id, 'market', 'porphyry')).toEqual({
      ok: false,
      reason: 'В провинции уже идёт строительство',
    })

    expect(advanceCampaign(campaign, 1, { aiExpansion: false })).not.toContainEqual(
      expect.objectContaining({ kind: 'project-completed' }),
    )
    const reports = advanceCampaign(campaign, 1, { aiExpansion: false })

    expect(province).toMatchObject({ cityLevel: 1, project: null })
    expect(reports).toContainEqual(expect.objectContaining({
      kind: 'project-completed',
      actorId: 'porphyry',
      provinceId: province.id,
    }))
    expect(realmDailyIncome(campaign, 'porphyry')).toBe(initialIncome + 1)
    expect(provinceLevyCap(province)).toBe(150)

    expect(musterProvince(campaign, foreign.id, 'porphyry')).toEqual({
      ok: false,
      reason: 'Для сбора выберите свою провинцию',
    })
    expect(startProvinceProject(campaign, foreign.id, 'market', 'porphyry')).toEqual({
      ok: false,
      reason: 'Для развития выберите свою провинцию',
    })
    expect(foreign).toEqual(foreignBefore)
  })

  it('separates settlement, market, fortification, and siege workshop effects', () => {
    const settlement = createCampaign('holding-effects')
    const market = createCampaign('holding-effects')
    const walls = createCampaign('holding-effects')
    const workshop = createCampaign('holding-effects')
    const settlementProvince = settlement.provinces.find((item) => item.owner === 'porphyry' && item.cityLevel === 0)!
    const marketProvince = market.provinces.find((item) => item.id === settlementProvince.id)!
    const wallProvince = walls.provinces.find((item) => item.id === settlementProvince.id)!
    const workshopProvince = workshop.provinces.find((item) => item.id === settlementProvince.id)!
    const baselineIncome = realmDailyIncome(settlement, 'porphyry')

    expect(startProvinceProject(settlement, settlementProvince.id, 'settlement')).toMatchObject({ ok: true })
    expect(startProvinceProject(market, marketProvince.id, 'market')).toMatchObject({ ok: true })
    expect(startProvinceProject(walls, wallProvince.id, 'fortification')).toMatchObject({ ok: true })
    expect(startProvinceProject(workshop, workshopProvince.id, 'workshop')).toMatchObject({ ok: true })
    advanceCampaign(settlement, 2, { aiExpansion: false })
    advanceCampaign(market, 2, { aiExpansion: false })
    advanceCampaign(walls, 2, { aiExpansion: false })
    advanceCampaign(workshop, 2, { aiExpansion: false })

    expect(settlementProvince).toMatchObject({ cityLevel: 1, marketLevel: 0, fortificationLevel: 0 })
    expect(marketProvince).toMatchObject({ cityLevel: 0, marketLevel: 1, fortificationLevel: 0 })
    expect(wallProvince).toMatchObject({ cityLevel: 0, marketLevel: 0, fortificationLevel: 1 })
    expect(workshopProvince).toMatchObject({ cityLevel: 0, marketLevel: 0, fortificationLevel: 0, workshopLevel: 1 })
    expect(realmDailyIncome(settlement, 'porphyry')).toBe(baselineIncome + 1)
    expect(realmDailyIncome(market, 'porphyry')).toBe(baselineIncome + 2)
    expect(realmDailyIncome(walls, 'porphyry')).toBe(baselineIncome)
    expect(realmDailyIncome(workshop, 'porphyry')).toBe(baselineIncome)
  })

  it('turns finished walls into a persistent siege instead of a single defense roll', () => {
    const open = createCampaign('wall-defense')
    const fortified = createCampaign('wall-defense')
    const openSource = open.provinces.find((province) => province.column === 2 && province.row === 4)!
    const openTarget = open.provinces.find((province) => province.column === 3 && province.row === 4)!
    const fortifiedSource = fortified.provinces.find((province) => province.id === openSource.id)!
    const fortifiedTarget = fortified.provinces.find((province) => province.id === openTarget.id)!
    for (const [source, target] of [[openSource, openTarget], [fortifiedSource, fortifiedTarget]]) {
      source.levies = 60
      target.owner = 'seljuk'
      target.levies = 24
      target.cityLevel = 0
      target.fortificationLevel = 0
      target.defenseFormation = 'line'
    }
    fortifiedTarget.fortificationLevel = 1

    expect(attackProvince(open, openSource.id, openTarget.id, 50, 'porphyry', 'line')).toMatchObject({
      ok: true,
      outcome: 'captured',
      defenseStrength: 24,
    })
    expect(attackProvince(fortified, fortifiedSource.id, fortifiedTarget.id, 50, 'porphyry', 'line')).toMatchObject({
      ok: true,
      outcome: 'besieged',
      committed: 30,
      siege: {
        targetId: fortifiedTarget.id,
        soldiers: 30,
        tactic: 'blockade',
        progress: 0,
      },
    })
    expect(fortifiedTarget.owner).not.toBe('porphyry')
    expect(fortified.sieges).toHaveLength(1)
    const reports = advanceCampaign(fortified, 1, { aiExpansion: false })
    expect(reports).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'siege-advanced', provinceId: fortifiedTarget.id }),
    ]))
    expect(fortified.sieges[0].progress).toBeGreaterThan(0)
  })

  it('loads a siege convoy from city infrastructure and consumes it each day', () => {
    const campaign = createCampaign('siege-logistics')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 120
    source.cityLevel = 1
    source.marketLevel = 1
    source.workshopLevel = 1
    target.owner = 'seljuk'
    target.levies = 80
    target.cityLevel = 0
    target.marketLevel = 0
    target.fortificationLevel = 1

    const started = attackProvince(campaign, source.id, target.id, 50, 'porphyry', 'line')

    expect(started).toMatchObject({
      ok: true,
      outcome: 'besieged',
      siege: { soldiers: 60, supplies: 12, engines: 1 },
    })
    if (!started.ok || started.outcome !== 'besieged') return
    advanceCampaign(campaign, 1, { aiExpansion: false })
    expect(started.siege.supplies).toBe(11)
  })

  it('slows siege work and increases camp losses when the convoy runs dry', () => {
    const supplied = createCampaign('siege-starvation')
    const starving = createCampaign('siege-starvation')
    const prepare = (campaign: ReturnType<typeof createCampaign>, supplies: number) => {
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
      source.levies = 120
      target.owner = 'seljuk'
      target.levies = 80
      target.cityLevel = 0
      target.marketLevel = 0
      target.fortificationLevel = 1
      const started = attackProvince(campaign, source.id, target.id, 50, 'porphyry', 'line')
      if (!started.ok || started.outcome !== 'besieged') throw new Error('siege did not start')
      started.siege.supplies = supplies
      return started.siege
    }
    const suppliedSiege = prepare(supplied, 12)
    const starvingSiege = prepare(starving, 0)

    expect(campaignSiegeProjectedDailyProgress(starving, starvingSiege, 'blockade')).toBe(10)
    expect(campaignSiegeProjectedDailyProgress(supplied, suppliedSiege, 'blockade')).toBe(20)
    advanceCampaign(supplied, 1, { aiExpansion: false })
    advanceCampaign(starving, 1, { aiExpansion: false })

    expect(starvingSiege.progress).toBeLessThan(suppliedSiege.progress)
    expect(starvingSiege.soldiers).toBeLessThan(suppliedSiege.soldiers)
  })

  it('uses workshop engines to win an assault that an unprepared army loses', () => {
    const plain = createCampaign('siege-engines')
    const equipped = createCampaign('siege-engines')
    const prepare = (campaign: ReturnType<typeof createCampaign>, engines: 0 | 2) => {
      const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
      const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
      source.levies = 120
      source.workshopLevel = engines
      target.owner = 'seljuk'
      target.levies = 60
      target.cityLevel = 0
      target.marketLevel = 0
      target.fortificationLevel = 1
      target.defenseFormation = 'line'
      const started = attackProvince(campaign, source.id, target.id, 50, 'porphyry', 'line')
      if (!started.ok || started.outcome !== 'besieged') throw new Error('siege did not start')
      started.siege.tactic = 'assault'
      return target
    }
    const plainTarget = prepare(plain, 0)
    const equippedTarget = prepare(equipped, 2)

    advanceCampaign(plain, 1, { aiExpansion: false })
    advanceCampaign(equipped, 1, { aiExpansion: false })

    expect(plainTarget.owner).toBe('seljuk')
    expect(equippedTarget.owner).toBe('porphyry')
  })

  it('lets the attacker fund sappers, order an assault, and damage captured walls', () => {
    const campaign = createCampaign('siege-assault')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 120
    target.owner = 'seljuk'
    target.levies = 20
    target.fortificationLevel = 1
    target.defenseFormation = 'line'
    const economy = realmEconomy(campaign, 'porphyry')!

    const started = attackProvince(campaign, source.id, target.id, 75, 'porphyry', 'wedge')
    expect(started).toMatchObject({ ok: true, outcome: 'besieged' })
    if (!started.ok || started.outcome !== 'besieged') return

    expect(setSiegeTactic(campaign, started.siege.id, 'sappers', 'porphyry')).toMatchObject({ ok: true })
    const beforeSappers = economy.silver
    advanceCampaign(campaign, 1, { aiExpansion: false })
    expect(economy.silver).toBe(beforeSappers + realmDailyIncome(campaign, 'porphyry') - 12)
    expect(started.siege.progress).toBeGreaterThan(20)

    expect(setSiegeTactic(campaign, started.siege.id, 'assault', 'porphyry')).toMatchObject({ ok: true })
    const reports = advanceCampaign(campaign, 1, { aiExpansion: false })
    expect(reports).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'siege-resolved', provinceId: target.id }),
    ]))
    expect(target).toMatchObject({ owner: 'porphyry', fortificationLevel: 0 })
    expect(campaign.sieges).toEqual([])
  })

  it('allows an orderly retreat or a risky defender sortie from the same siege state', () => {
    const retreatCampaign = createCampaign('siege-retreat')
    const retreatSource = retreatCampaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const retreatTarget = retreatCampaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    retreatSource.levies = 80
    retreatTarget.owner = 'seljuk'
    retreatTarget.levies = 24
    retreatTarget.fortificationLevel = 1
    const retreatStarted = attackProvince(retreatCampaign, retreatSource.id, retreatTarget.id, 50)
    expect(retreatStarted).toMatchObject({ ok: true, outcome: 'besieged' })
    if (!retreatStarted.ok || retreatStarted.outcome !== 'besieged') return
    expect(retreatSiege(retreatCampaign, retreatStarted.siege.id, 'porphyry')).toMatchObject({ ok: true })
    expect(retreatSource.levies).toBe(70)
    expect(retreatCampaign.sieges).toEqual([])

    const sortieCampaign = createCampaign('siege-sortie')
    const sortieSource = sortieCampaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const sortieTarget = sortieCampaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    sortieSource.levies = 28
    sortieTarget.owner = 'seljuk'
    sortieTarget.levies = 80
    sortieTarget.fortificationLevel = 1
    sortieTarget.defenseFormation = 'line'
    const sortieStarted = attackProvince(sortieCampaign, sortieSource.id, sortieTarget.id, 50, 'porphyry', 'wedge')
    expect(sortieStarted).toMatchObject({ ok: true, outcome: 'besieged' })
    if (!sortieStarted.ok || sortieStarted.outcome !== 'besieged') return
    expect(sortieSiege(sortieCampaign, sortieStarted.siege.id, 'seljuk')).toMatchObject({ ok: true })
    expect(sortieCampaign.sieges).toEqual([])
    expect(sortieTarget.levies).toBeLessThan(80)
  })

  it('lifts undersized siege camps without reducing an over-capacity source garrison', () => {
    const campaign = createCampaign('siege-small-camp')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 80
    target.owner = 'seljuk'
    target.levies = 24
    target.fortificationLevel = 1
    const started = attackProvince(campaign, source.id, target.id, 50)
    expect(started).toMatchObject({ ok: true, outcome: 'besieged' })
    if (!started.ok || started.outcome !== 'besieged') return

    source.levies = 305
    started.siege.soldiers = 3
    started.siege.tactic = 'assault'
    const reports = advanceCampaign(campaign, 1, { aiExpansion: false })

    expect(reports).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'siege-lifted', provinceId: target.id }),
    ]))
    expect(source.levies).toBe(305)
    expect(target).toMatchObject({ owner: 'seljuk', levies: 24 })
    expect(campaign.sieges).toEqual([])
  })

  it('combines an arriving army with its exact siege and lets a stronger relief force break the camp', () => {
    const campaign = createCampaign('siege-field-maneuvers')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    const attackerReserve = campaign.provinces.find((province) => province.column === 3 && province.row === 3)!
    const defenderReserve = campaign.provinces.find((province) => province.column === 4 && province.row === 4)!
    source.owner = 'porphyry'
    source.levies = 120
    source.workshopLevel = 1
    attackerReserve.owner = 'porphyry'
    attackerReserve.levies = 80
    attackerReserve.cityLevel = 1
    attackerReserve.marketLevel = 1
    attackerReserve.workshopLevel = 2
    defenderReserve.owner = 'seljuk'
    defenderReserve.levies = 200
    target.owner = 'seljuk'
    target.levies = 30
    target.fortificationLevel = 1
    const started = attackProvince(campaign, source.id, target.id, 75, 'porphyry', 'line')
    expect(started).toMatchObject({ ok: true, outcome: 'besieged' })
    if (!started.ok || started.outcome !== 'besieged') return

    const reinforcement = beginSiegeMarch(campaign, {
      id: 'reinforce-exact-siege',
      siegeId: started.siege.id,
      actorId: 'porphyry',
      sourceId: attackerReserve.id,
      commitmentPercent: 50,
      formation: 'shieldwall',
      departedAt: 10,
      arrivesAt: 20,
    })
    expect(reinforcement).toMatchObject({
      ok: true,
      march: { kind: 'attack', siegeId: started.siege.id, soldiers: 40, supplies: 12, engines: 2 },
    })
    const suppliesBeforeReinforcement = started.siege.supplies
    expect(resolveCampaignMarches(campaign, 20)).toContainEqual(expect.objectContaining({
      outcome: 'siege-reinforced',
      targetId: target.id,
    }))
    expect(started.siege).toMatchObject({
      soldiers: 130,
      formation: 'line',
      supplies: (suppliesBeforeReinforcement ?? 0) + 12,
      engines: 2,
    })

    const relief = beginSiegeMarch(campaign, {
      id: 'relieve-exact-siege',
      siegeId: started.siege.id,
      actorId: 'seljuk',
      sourceId: defenderReserve.id,
      commitmentPercent: 75,
      formation: 'wedge',
      departedAt: 21,
      arrivesAt: 30,
    })
    expect(relief).toMatchObject({
      ok: true,
      march: { kind: 'support', siegeId: started.siege.id, soldiers: 150 },
    })
    expect(resolveCampaignMarches(campaign, 30)).toContainEqual(expect.objectContaining({
      outcome: 'siege-relieved',
      formationModifier: 0.2,
    }))
    expect(campaign.sieges).toEqual([])
    expect(target.levies).toBeGreaterThan(30)
  })

  it('weakens an ongoing siege after a failed relief attack and cancels a march bound to a lifted camp', () => {
    const campaign = createCampaign('siege-failed-relief')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    const reserve = campaign.provinces.find((province) => province.column === 4 && province.row === 4)!
    source.owner = 'porphyry'
    source.levies = 120
    reserve.owner = 'seljuk'
    reserve.levies = 40
    target.owner = 'seljuk'
    target.levies = 30
    target.fortificationLevel = 1
    const started = attackProvince(campaign, source.id, target.id, 75, 'porphyry', 'wedge')
    expect(started).toMatchObject({ ok: true, outcome: 'besieged' })
    if (!started.ok || started.outcome !== 'besieged') return
    started.siege.progress = 30

    const relief = executeSiegeManeuver(campaign, reserve.id, started.siege.id, 50, 'seljuk', 'line')
    expect(relief).toMatchObject({
      outcome: 'relief-repelled',
      formationModifier: -0.2,
    })
    expect(started.siege.progress).toBe(20)
    expect(started.siege.soldiers).toBeLessThan(90)

    const reinforcement = beginSiegeMarch(campaign, {
      id: 'late-reinforcement',
      siegeId: started.siege.id,
      actorId: 'porphyry',
      sourceId: source.id,
      commitmentPercent: 50,
      formation: 'line',
      departedAt: 40,
      arrivesAt: 50,
    })
    expect(reinforcement).toMatchObject({ ok: true })
    campaign.sieges = []
    const sourceAfterDeparture = source.levies
    expect(resolveCampaignMarches(campaign, 50)).toContainEqual(expect.objectContaining({
      outcome: 'cancelled',
      message: expect.stringContaining('эта осада уже не действует'),
    }))
    expect(source.levies).toBeGreaterThan(sourceAfterDeparture)
  })

  it('allows an allied relief column only when that ally is also at war with the besieger', () => {
    const campaign = createCampaign('allied-siege-relief')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    const bulgarReserve = campaign.provinces.find((province) => province.column === 4 && province.row === 4)!
    source.owner = 'porphyry'
    source.levies = 120
    target.owner = 'seljuk'
    target.levies = 30
    target.fortificationLevel = 1
    bulgarReserve.owner = 'bulgar'
    bulgarReserve.levies = 80
    const started = attackProvince(campaign, source.id, target.id, 75, 'porphyry', 'line')
    expect(started).toMatchObject({ ok: true, outcome: 'besieged' })
    if (!started.ok || started.outcome !== 'besieged') return

    campaignRelation(campaign, 'seljuk', 'bulgar')!.status = 'alliance'
    expect(beginSiegeMarch(campaign, {
      id: 'neutral-ally-cannot-relieve',
      siegeId: started.siege.id,
      actorId: 'bulgar',
      sourceId: bulgarReserve.id,
      commitmentPercent: 50,
      formation: 'wedge',
      departedAt: 10,
      arrivesAt: 20,
    })).toMatchObject({ ok: false, reason: 'Ваша держава не участвует в этой осаде' })

    campaignRelation(campaign, 'porphyry', 'bulgar')!.status = 'war'
    expect(beginSiegeMarch(campaign, {
      id: 'belligerent-ally-relief',
      siegeId: started.siege.id,
      actorId: 'bulgar',
      sourceId: bulgarReserve.id,
      commitmentPercent: 50,
      formation: 'wedge',
      departedAt: 10,
      arrivesAt: 20,
    })).toMatchObject({
      ok: true,
      march: { kind: 'support', siegeId: started.siege.id, actorId: 'bulgar' },
    })
  })

  it('joins a simultaneous reinforcement to the camp before resolving the relief battle', () => {
    const campaign = createCampaign('simultaneous-siege-columns')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    const attackerReserve = campaign.provinces.find((province) => province.column === 3 && province.row === 3)!
    const alliedReserve = campaign.provinces.find((province) => province.column === 4 && province.row === 4)!
    source.owner = 'porphyry'
    source.levies = 120
    attackerReserve.owner = 'porphyry'
    attackerReserve.levies = 80
    alliedReserve.owner = 'bulgar'
    alliedReserve.levies = 200
    target.owner = 'seljuk'
    target.levies = 30
    target.fortificationLevel = 1
    const started = attackProvince(campaign, source.id, target.id, 75, 'porphyry', 'line')
    expect(started).toMatchObject({ ok: true, outcome: 'besieged' })
    if (!started.ok || started.outcome !== 'besieged') return
    campaignRelation(campaign, 'seljuk', 'bulgar')!.status = 'alliance'
    campaignRelation(campaign, 'porphyry', 'bulgar')!.status = 'war'

    expect(beginSiegeMarch(campaign, {
      id: 'simultaneous-relief',
      siegeId: started.siege.id,
      actorId: 'bulgar',
      sourceId: alliedReserve.id,
      commitmentPercent: 75,
      formation: 'wedge',
      departedAt: 10,
      arrivesAt: 20,
    })).toMatchObject({ ok: true })
    expect(beginSiegeMarch(campaign, {
      id: 'simultaneous-reinforcement',
      siegeId: started.siege.id,
      actorId: 'porphyry',
      sourceId: attackerReserve.id,
      commitmentPercent: 50,
      formation: 'shieldwall',
      departedAt: 10,
      arrivesAt: 20,
    })).toMatchObject({ ok: true })

    const reports = resolveCampaignMarches(campaign, 20)
    expect(reports.map((report) => report.outcome)).toEqual([
      'siege-reinforced',
      'siege-relieved',
    ])
  })

  it('lets a counter-formation change a close field battle', () => {
    const advantaged = createCampaign('formation-advantage')
    const disadvantaged = createCampaign('formation-advantage')
    const advantagedSource = advantaged.provinces.find((province) => province.column === 2 && province.row === 4)!
    const advantagedTarget = advantaged.provinces.find((province) => province.column === 3 && province.row === 4)!
    const disadvantagedSource = disadvantaged.provinces.find((province) => province.column === 2 && province.row === 4)!
    const disadvantagedTarget = disadvantaged.provinces.find((province) => province.column === 3 && province.row === 4)!
    for (const [source, target] of [[advantagedSource, advantagedTarget], [disadvantagedSource, disadvantagedTarget]]) {
      source.levies = 52
      target.levies = 28
      target.defenseFormation = 'shieldwall'
    }

    const lineResult = attackProvince(advantaged, advantagedSource.id, advantagedTarget.id, 50, 'porphyry', 'line')
    const wedgeResult = attackProvince(disadvantaged, disadvantagedSource.id, disadvantagedTarget.id, 50, 'porphyry', 'wedge')

    expect(lineResult).toMatchObject({
      ok: true,
      outcome: 'captured',
      formationModifier: 0.2,
      attackStrength: 31,
      defenseStrength: 28,
    })
    expect(wedgeResult).toMatchObject({
      ok: true,
      outcome: 'repelled',
      formationModifier: -0.2,
      attackStrength: 21,
      defenseStrength: 28,
    })
  })

  it('changes defensive formation only for an owned province', () => {
    const campaign = createCampaign('defensive-order')
    const owned = campaign.provinces.find((province) => province.owner === 'porphyry')!
    const foreign = campaign.provinces.find((province) => province.owner === 'seljuk')!
    const foreignBefore = foreign.defenseFormation

    expect(setProvinceDefenseFormation(campaign, owned.id, 'wedge', 'porphyry')).toMatchObject({ ok: true })
    expect(owned.defenseFormation).toBe('wedge')
    expect(setProvinceDefenseFormation(campaign, foreign.id, 'shieldwall', 'porphyry')).toEqual({
      ok: false,
      reason: 'Для оборонного строя выберите свою провинцию',
    })
    expect(foreign.defenseFormation).toBe(foreignBefore)
  })

  it('plunders a captured capital and moves the defeated ruler seat deterministically', () => {
    const campaign = createCampaign('fallen-capital')
    const capital = campaign.provinces.find((province) => province.capitalOf === 'seljuk')!
    const source = campaign.provinces.find((province) => (
      province.column === capital.column - 1 && province.row === capital.row
    ))!
    source.owner = 'porphyry'
    source.levies = 120
    capital.levies = 8
    capital.fortificationLevel = 0
    capital.defenseFormation = 'line'
    const attackerEconomy = realmEconomy(campaign, 'porphyry')!
    const defenderEconomy = realmEconomy(campaign, 'seljuk')!

    const result = attackProvince(campaign, source.id, capital.id, 50, 'porphyry', 'wedge')

    expect(result).toMatchObject({
      ok: true,
      outcome: 'captured',
      capitalCaptured: true,
      defeatedRealmId: null,
      winnerRealmId: null,
    })
    expect(attackerEconomy.silver).toBe(92 + CAMPAIGN_CAPITAL_LOOT)
    expect(attackerEconomy.legitimacy).toBe(74)
    expect(defenderEconomy.silver).toBe(92 - CAMPAIGN_CAPITAL_LOOT)
    expect(defenderEconomy.legitimacy).toBe(53)
    expect(capital.capitalOf).toBeNull()
    expect(campaign.provinces.find((province) => province.capitalOf === 'seljuk')).toMatchObject({
      owner: 'seljuk',
    })
  })

  it('eliminates the last landowner, cancels its armies, and declares the sole survivor', () => {
    const campaign = createCampaign('last-banner')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
    for (const province of campaign.provinces) {
      province.owner = 'porphyry'
      province.capitalOf = null
    }
    source.levies = 120
    target.owner = 'seljuk'
    target.levies = 8
    target.cityLevel = 2
    target.defenseFormation = 'line'
    target.capitalOf = 'seljuk'
    const bulgar = campaign.realms.find((realm) => realm.id === 'bulgar')!
    bulgar.status = 'defeated'
    bulgar.defeatedAt = 0
    bulgar.defeatedBy = 'porphyry'
    campaign.marches.push({
      id: 'last-seljuk-army',
      kind: 'attack',
      actorId: 'seljuk',
      sourceId: target.id,
      targetId: source.id,
      route: [target.id, source.id],
      soldiers: 20,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })

    const result = attackProvince(campaign, source.id, target.id, 75, 'porphyry', 'wedge')

    expect(result).toMatchObject({
      ok: true,
      outcome: 'captured',
      capitalCaptured: true,
      defeatedRealmId: 'seljuk',
      winnerRealmId: 'porphyry',
    })
    expect(campaign.realms.find((realm) => realm.id === 'seljuk')).toMatchObject({
      status: 'defeated',
      defeatedAt: 0,
      defeatedBy: 'porphyry',
    })
    expect(campaign.marches).toEqual([])
    expect(campaign.winnerRealmId).toBe('porphyry')
    expect(campaignActionBlockReason(campaign, 'porphyry')).toBe('Матч уже завершён')
    expect(musterProvince(campaign, source.id, 'porphyry')).toEqual({
      ok: false,
      reason: 'Матч уже завершён',
    })
    expect(advanceCampaign(campaign, 4)).toEqual([])
    expect(campaign.tick).toBe(0)
    expect(target.capitalOf).toBeNull()
  })

  it('cancels a simultaneous due march after its realm loses the last province', () => {
    const campaign = createCampaign('defeated-due-march')
    const porphyrySource = campaign.provinces.find((province) => province.column === 2 && province.row === 5)!
    const seljukSource = campaign.provinces.find((province) => province.column === 3 && province.row === 5)!
    const porphyryTarget = campaign.provinces.find((province) => province.column === 4 && province.row === 5)!
    for (const province of campaign.provinces) {
      if (province.owner === 'seljuk') province.owner = null
      if (province.capitalOf === 'seljuk') province.capitalOf = null
    }
    porphyrySource.levies = 120
    seljukSource.owner = 'seljuk'
    seljukSource.levies = 80
    seljukSource.cityLevel = 2
    seljukSource.defenseFormation = 'line'
    seljukSource.capitalOf = 'seljuk'
    porphyryTarget.owner = 'porphyry'
    porphyryTarget.levies = 30

    expect(beginCampaignMarch(campaign, {
      id: 'seljuk-countermarch',
      actorId: 'seljuk',
      sourceId: seljukSource.id,
      targetId: porphyryTarget.id,
      commitmentPercent: 50,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({ ok: true })
    expect(beginCampaignMarch(campaign, {
      id: 'porphyry-final-march',
      actorId: 'porphyry',
      sourceId: porphyrySource.id,
      targetId: seljukSource.id,
      commitmentPercent: 75,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({ ok: true })

    const reports = resolveCampaignMarches(campaign, 4000)

    expect(reports.map((report) => [report.actorId, report.outcome])).toEqual([
      ['porphyry', 'captured'],
      ['seljuk', 'cancelled'],
    ])
    expect(reports[1].message).toContain('держава больше не владеет землями')
    expect(porphyryTarget).toMatchObject({ owner: 'porphyry', levies: 30 })
    expect(campaign.realms.find((realm) => realm.id === 'seljuk')?.status).toBe('defeated')
    expect(campaign.winnerRealmId).toBeNull()
  })

  it('locks the defensive formation after a hostile march has departed', () => {
    const campaign = createCampaign('locked-defense')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    source.levies = 80
    target.owner = 'seljuk'

    expect(beginCampaignMarch(campaign, {
      id: 'incoming',
      actorId: 'porphyry',
      sourceId: source.id,
      targetId: target.id,
      commitmentPercent: 50,
      formation: 'wedge',
      departedAt: 1000,
      arrivesAt: 4000,
    })).toMatchObject({ ok: true })
    expect(setProvinceDefenseFormation(campaign, target.id, 'shieldwall', 'seljuk')).toEqual({
      ok: false,
      reason: 'Гарнизон уже встречает вражеский поход',
    })
  })
})

import { DEFAULT_NATION_ID, NATIONS, type NationDefinition, type NationId, type NationRuler } from './nations'
import {
  FORMATION_SHAPE_LABELS,
  FORMATION_SHAPES,
  formationMatchupModifier,
  type FormationShape,
} from './tactics'

export type RealmId = NationId
export type DiplomaticStatus = 'war' | 'neutral' | 'truce' | 'alliance'
export type RealmStatus = 'active' | 'defeated'
export type ProvinceLevel = 0 | 1 | 2
export type ProvinceProjectKind = 'settlement' | 'market' | 'fortification' | 'workshop'
export type CampaignMarchKind = 'attack' | 'support'
export type CampaignSiegeTactic = 'blockade' | 'sappers' | 'assault'
export type CampaignSiegeMarchRole = 'reinforce' | 'relief'
export type CampaignCommitment = number

export const CAMPAIGN_COMMITMENT_MIN = 10
export const CAMPAIGN_COMMITMENT_MAX = 90
export const CAMPAIGN_COMMITMENT_STEP = 5

export function isCampaignCommitment(value: unknown): value is CampaignCommitment {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= CAMPAIGN_COMMITMENT_MIN
    && value <= CAMPAIGN_COMMITMENT_MAX
    && value % CAMPAIGN_COMMITMENT_STEP === 0
}

export type Ruler = NationRuler

export interface Realm {
  id: RealmId
  name: string
  shortName: string
  mapStyle: NationDefinition['mapStyle']
  ruler: Ruler
  status: RealmStatus
  defeatedAt: number | null
  defeatedBy: RealmId | null
}

export interface RealmEconomy {
  realmId: RealmId
  silver: number
  legitimacy: number
}

export interface DiplomaticRelation {
  realmIds: [RealmId, RealmId]
  status: DiplomaticStatus
  opinion: number
  truceUntil: number | null
  tradeEmbargoes: RealmId[]
}

export interface AllianceOffer {
  fromRealmId: RealmId
  toRealmId: RealmId
  offeredAt: number
}

export interface CampaignPeaceOffer {
  fromRealmId: RealmId
  toRealmId: RealmId
  demandedProvinceId: number | null
  offeredAt: number
}

export interface CampaignTradeRoute {
  id: string
  realmIds: [RealmId, RealmId]
  provinceIds: [number, number]
  openedAt: number
}

export interface CampaignSiege {
  id: string
  attackerId: RealmId
  defenderId: RealmId
  sourceId: number
  targetId: number
  soldiers: number
  formation: FormationShape
  tactic: CampaignSiegeTactic
  progress: number
  supplies?: number
  engines?: number
  startedAt: number
  lastResolvedAt: number
}

export interface Province {
  id: number
  name: string
  column: number
  row: number
  owner: RealmId | null
  levies: number
  cityLevel: ProvinceLevel
  marketLevel: ProvinceLevel
  fortificationLevel: ProvinceLevel
  workshopLevel: ProvinceLevel
  project: ProvinceProject | null
  defenseFormation: FormationShape
  capitalOf: RealmId | null
  homelandOf: RealmId | null
  homelandCapitalOf: RealmId | null
}

export interface ProvinceProject {
  kind: ProvinceProjectKind
  startedAt: number
  completesAt: number
}

export interface CampaignMarch {
  id: string
  kind: CampaignMarchKind
  siegeId?: string
  actorId: RealmId
  sourceId: number
  targetId: number
  route: number[]
  soldiers: number
  formation: FormationShape
  supplies?: number
  engines?: number
  departedAt: number
  arrivesAt: number
}

export interface CampaignState {
  playerRealmId: RealmId
  tick: number
  realms: Realm[]
  economies: RealmEconomy[]
  relations: DiplomaticRelation[]
  allianceOffers: AllianceOffer[]
  peaceOffers: CampaignPeaceOffer[]
  tradeRoutes: CampaignTradeRoute[]
  sieges: CampaignSiege[]
  provinces: Province[]
  marches: CampaignMarch[]
  winnerRealmId: RealmId | null
}

export interface CampaignResolvedAttackResult {
  ok: true
  outcome: 'captured' | 'repelled'
  committed: number
  attackerLosses: number
  defenderLosses: number
  targetId: number
  previousOwner: RealmId | null
  formation: FormationShape
  defenseFormation: FormationShape
  formationModifier: number
  attackStrength: number
  defenseStrength: number
  capitalCaptured: boolean
  defeatedRealmId: RealmId | null
  winnerRealmId: RealmId | null
}

export interface CampaignSiegeStartResult {
  ok: true
  outcome: 'besieged'
  committed: number
  targetId: number
  siege: CampaignSiege
}

export type CampaignAttackResult = CampaignResolvedAttackResult | CampaignSiegeStartResult
export type CampaignAttackFailure = { ok: false; reason: string }
export type CampaignCommandResult = { ok: true; message: string } | { ok: false; reason: string }
export type CampaignMarchOrderResult =
  | { ok: true; message: string; march: CampaignMarch }
  | CampaignAttackFailure

export interface CampaignMarchResolution {
  marchId: string
  actorId: RealmId
  targetId: number
  outcome:
    | 'captured'
    | 'repelled'
    | 'reinforced'
    | 'besieged'
    | 'siege-reinforced'
    | 'siege-relieved'
    | 'relief-repelled'
    | 'intercepted'
    | 'cancelled'
  message: string
  formation: FormationShape
  defenseFormation: FormationShape
  formationModifier: number
  capitalCaptured: boolean
  previousOwner?: RealmId | null
  defeatedRealmId: RealmId | null
  winnerRealmId: RealmId | null
}

export interface CampaignTurnReport {
  kind:
    | 'conquest'
    | 'march-started'
    | 'march-resolved'
    | 'truce-ended'
    | 'project-completed'
    | 'siege-advanced'
    | 'siege-resolved'
    | 'siege-lifted'
  actorId: RealmId
  targetOwner: RealmId | null
  provinceId: number | null
  message: string
}

export interface CampaignMarchTiming {
  departedAt: number
  legDurationMs: number
}

export interface AdvanceCampaignOptions {
  aiExpansion?: boolean
  aiRealmIds?: readonly RealmId[]
  marchTiming?: CampaignMarchTiming
}

export const PROVINCE_PROJECTS: Record<ProvinceProjectKind, {
  label: string
  cost: number
  durationDays: number
  effect: string
}> = {
  settlement: {
    label: 'Расширить посад',
    cost: 54,
    durationDays: 2,
    effect: 'Больше дохода, ополчения и предел гарнизона',
  },
  market: {
    label: 'Учредить торг',
    cost: 42,
    durationDays: 2,
    effect: 'Ещё 2 номисмы дохода в день за уровень',
  },
  fortification: {
    label: 'Поднять укрепления',
    cost: 60,
    durationDays: 2,
    effect: 'Каждый уровень усиливает оборону на 25%',
  },
  workshop: {
    label: 'Развернуть осадный двор',
    cost: 66,
    durationDays: 2,
    effect: 'Оснащает походы машинами для подкопа и штурма',
  },
}

export const CAMPAIGN_MUSTER_COST = 24
export const CAMPAIGN_GIFT_COST = 30
export const CAMPAIGN_WAR_LEGITIMACY_COST = 8
export const CAMPAIGN_PEACE_DEMAND_SCORE = 40
export const CAMPAIGN_CAPITAL_LOOT = 40
export const CAMPAIGN_MARCH_RECALL_LOSS = 0.25
export const CAMPAIGN_SIEGE_RETREAT_LOSS = 0.25
export const CAMPAIGN_SAPPER_DAILY_COST = 12
export const CAMPAIGN_SIEGE_TACTICS: Record<CampaignSiegeTactic, {
  label: string
  effect: string
}> = {
  blockade: {
    label: 'Блокада',
    effect: 'Медленное истощение с наименьшими потерями',
  },
  sappers: {
    label: 'Подкоп',
    effect: `Быстрый пролом за ${CAMPAIGN_SAPPER_DAILY_COST} номисм в день`,
  },
  assault: {
    label: 'Штурм',
    effect: 'Решающий бой на следующем рассвете',
  },
}
export const ALLIANCE_SILVER_AMOUNTS = [15, 30, 60] as const
export type AllianceSilverAmount = typeof ALLIANCE_SILVER_AMOUNTS[number]

const PROVINCE_PREFIXES = ['Агио', 'Белый', 'Верхний', 'Долгий', 'Златой', 'Каменный', 'Малый', 'Нижний']
const PROVINCE_ROOTS = ['Брод', 'Дол', 'Ключ', 'Лог', 'Перевал', 'Посад', 'Рубеж', 'Стан']
function provinceOwner(column: number, row: number, nations: readonly NationDefinition[]): RealmId | null {
  return nations.find((nation) => (
    column >= nation.startingArea.columns[0]
    && column <= nation.startingArea.columns[1]
    && row >= nation.startingArea.rows[0]
    && row <= nation.startingArea.rows[1]
  ))?.id ?? null
}

function startingDefenseFormation(owner: RealmId | null, nations: readonly NationDefinition[]): FormationShape {
  const style = nations.find((nation) => nation.id === owner)?.mapStyle
  return style === 'imperial' ? 'shieldwall' : style === 'steppe' ? 'wedge' : 'line'
}

function startingRelation(leftId: RealmId, rightId: RealmId): DiplomaticRelation {
  const isPorphyrySeljuk = [leftId, rightId].includes('porphyry') && [leftId, rightId].includes('seljuk')
  const isPorphyryBulgar = [leftId, rightId].includes('porphyry') && [leftId, rightId].includes('bulgar')
  return {
    realmIds: [leftId, rightId],
    status: isPorphyrySeljuk ? 'war' : 'neutral',
    opinion: isPorphyrySeljuk ? -65 : isPorphyryBulgar ? 10 : 0,
    truceUntil: null,
    tradeEmbargoes: [],
  }
}

export function createCampaign(seed: string, nations: readonly NationDefinition[] = NATIONS): CampaignState {
  const seedOffset = [...seed].reduce((total, character) => total + character.charCodeAt(0), 0) % 8
  const provinces: Province[] = []
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const id = row * 8 + column
      const owner = provinceOwner(column, row, nations)
      const capitalOf = nations.find((nation) => nation.capital.column === column && nation.capital.row === row)?.id ?? null
      const capital = capitalOf !== null
      const cityLevel: Province['cityLevel'] = capital ? 2 : (id + seedOffset) % 11 === 0 ? 1 : 0
      const baseLevies = owner === DEFAULT_NATION_ID ? 28 : owner ? 24 : 13
      provinces.push({
        id,
        name: `${PROVINCE_PREFIXES[(row + seedOffset) % PROVINCE_PREFIXES.length]} ${PROVINCE_ROOTS[(column * 3 + row) % PROVINCE_ROOTS.length]}`,
        column,
        row,
        owner,
        levies: baseLevies + cityLevel * 12 + ((column * 5 + row * 3 + seedOffset) % 7),
        cityLevel,
        marketLevel: capital ? 1 : 0,
        fortificationLevel: capital ? 1 : 0,
        workshopLevel: 0,
        project: null,
        defenseFormation: startingDefenseFormation(owner, nations),
        capitalOf,
        homelandOf: owner,
        homelandCapitalOf: capitalOf,
      })
    }
  }

  return {
    playerRealmId: nations[0]?.id ?? DEFAULT_NATION_ID,
    tick: 0,
    realms: nations.map(({ startingArea: _startingArea, capital: _capital, ...nation }) => ({
      ...nation,
      ruler: { ...nation.ruler },
      status: 'active' as const,
      defeatedAt: null,
      defeatedBy: null,
    })),
    economies: nations.map((nation) => ({
      realmId: nation.id,
      silver: 92,
      legitimacy: 68,
    })),
    relations: nations.flatMap((left, leftIndex) => (
      nations.slice(leftIndex + 1).map((right) => startingRelation(left.id, right.id))
    )),
    allianceOffers: [],
    peaceOffers: [],
    tradeRoutes: [],
    sieges: [],
    provinces,
    marches: [],
    winnerRealmId: null,
  }
}

export function normalizeCampaign(value: unknown, seed: string): CampaignState {
  const baseline = createCampaign(seed)
  if (!value || typeof value !== 'object') return baseline
  const saved = value as {
    playerRealmId?: RealmId
    tick?: number
    realms?: Array<{
      id?: RealmId
      name?: string
      ruler?: Partial<Ruler> | string
      status?: RealmStatus
      defeatedAt?: number | null
      defeatedBy?: RealmId | null
    }>
    economies?: RealmEconomy[]
    relations?: Array<Partial<DiplomaticRelation> & { realmId?: RealmId }>
    allianceOffers?: AllianceOffer[]
    peaceOffers?: CampaignPeaceOffer[]
    tradeRoutes?: CampaignTradeRoute[]
    sieges?: CampaignSiege[]
    provinces?: Province[]
    marches?: CampaignMarch[]
    winnerRealmId?: RealmId | null
  }
  const savedProvinces = Array.isArray(saved.provinces) ? saved.provinces : []
  const provinces = baseline.provinces.map((province) => {
    const candidate = savedProvinces.find((item) => item?.id === province.id)
    if (!candidate) return province
    const cityLevel = provinceLevel(candidate.cityLevel, province.cityLevel)
    const marketLevel = provinceLevel(candidate.marketLevel, province.marketLevel)
    const fortificationLevel = provinceLevel(
      candidate.fortificationLevel,
      provinceLevel(candidate.cityLevel, province.fortificationLevel),
    )
    const workshopLevel = provinceLevel(candidate.workshopLevel, province.workshopLevel)
    const project = candidate?.project
    const projectLevel = project?.kind === 'settlement'
      ? cityLevel
      : project?.kind === 'market'
        ? marketLevel
        : project?.kind === 'fortification'
          ? fortificationLevel
          : workshopLevel
    const startedAt = Math.max(0, Math.floor(project?.startedAt ?? 0))
    const completesAt = Math.max(1, Math.floor(project?.completesAt ?? 0))
    return {
          ...province,
          ...candidate,
          cityLevel,
          marketLevel,
          fortificationLevel,
          workshopLevel,
          project: project
            && (
              project.kind === 'settlement'
              || project.kind === 'market'
              || project.kind === 'fortification'
              || project.kind === 'workshop'
            )
            && Number.isFinite(project.startedAt)
            && Number.isFinite(project.completesAt)
            && completesAt > startedAt
            && projectLevel < 2
            ? {
                kind: project.kind,
                startedAt,
                completesAt,
              }
            : null,
          defenseFormation: FORMATION_SHAPES.includes(candidate.defenseFormation)
            ? candidate.defenseFormation
            : province.defenseFormation,
          capitalOf: candidate.capitalOf === null || baseline.realms.some((realm) => realm.id === candidate.capitalOf)
            ? candidate.capitalOf
            : province.capitalOf,
          homelandOf: candidate.homelandOf === null || baseline.realms.some((realm) => realm.id === candidate.homelandOf)
            ? candidate.homelandOf
            : province.homelandOf,
          homelandCapitalOf: candidate.homelandCapitalOf === null
            || baseline.realms.some((realm) => realm.id === candidate.homelandCapitalOf)
            ? candidate.homelandCapitalOf
            : province.homelandCapitalOf,
        }
  })
  const realms = baseline.realms.map((realm) => {
    const candidate = Array.isArray(saved.realms) ? saved.realms.find((item) => item?.id === realm.id) : undefined
    const candidateRuler = candidate?.ruler
    const ruler = typeof candidateRuler === 'string'
      ? { ...realm.ruler, name: candidateRuler.replace(/^(Стратег|Бей|Кан)\s+/u, '') }
      : { ...realm.ruler, ...(candidateRuler ?? {}) }
    const status: RealmStatus = candidate?.status === 'defeated' ? 'defeated' : 'active'
    return {
      ...realm,
      ...(candidate ?? {}),
      ruler,
      status,
      defeatedAt: status === 'defeated' && Number.isFinite(candidate?.defeatedAt)
        ? Math.max(0, Math.floor(candidate!.defeatedAt!))
        : null,
      defeatedBy: status === 'defeated' && baseline.realms.some((item) => item.id === candidate?.defeatedBy)
        ? candidate!.defeatedBy!
        : null,
    }
  })
  const relations = baseline.relations.map((relation) => {
    const candidate = Array.isArray(saved.relations)
      ? saved.relations.find((item) => {
        if (Array.isArray(item?.realmIds)) {
          return relation.realmIds.every((realmId) => item.realmIds?.includes(realmId))
        }
        return relation.realmIds[0] === baseline.playerRealmId && item?.realmId === relation.realmIds[1]
      })
      : undefined
    return candidate
      ? {
          ...relation,
          status: candidate.status ?? relation.status,
          opinion: candidate.opinion ?? relation.opinion,
          truceUntil: candidate.truceUntil ?? relation.truceUntil,
          tradeEmbargoes: Array.isArray(candidate.tradeEmbargoes)
            ? [...new Set(candidate.tradeEmbargoes.filter((realmId) => relation.realmIds.includes(realmId)))]
            : [],
        }
      : relation
  })
  const economies = baseline.economies.map((economy) => {
    const candidate = Array.isArray(saved.economies)
      ? saved.economies.find((item) => item?.realmId === economy.realmId)
      : undefined
    return {
      realmId: economy.realmId,
      silver: Number.isFinite(candidate?.silver) ? Math.max(0, Math.floor(candidate!.silver)) : economy.silver,
      legitimacy: Number.isFinite(candidate?.legitimacy)
        ? Math.max(0, Math.min(100, Math.floor(candidate!.legitimacy)))
        : economy.legitimacy,
    }
  })
  const allianceOffers: AllianceOffer[] = []
  if (Array.isArray(saved.allianceOffers)) {
    for (const candidate of saved.allianceOffers) {
      if (
        !candidate
        || typeof candidate.fromRealmId !== 'string'
        || typeof candidate.toRealmId !== 'string'
        || candidate.fromRealmId === candidate.toRealmId
        || !realms.some((realm) => realm.id === candidate.fromRealmId && realm.status === 'active')
        || !realms.some((realm) => realm.id === candidate.toRealmId && realm.status === 'active')
        || !Number.isFinite(candidate.offeredAt)
      ) continue
      const relation = relations.find((item) => (
        item.realmIds.includes(candidate.fromRealmId) && item.realmIds.includes(candidate.toRealmId)
      ))
      if (
        relation?.status !== 'neutral'
        || allianceOffers.some((offer) => (
          [offer.fromRealmId, offer.toRealmId].includes(candidate.fromRealmId)
          && [offer.fromRealmId, offer.toRealmId].includes(candidate.toRealmId)
        ))
      ) continue
      allianceOffers.push({
        fromRealmId: candidate.fromRealmId,
        toRealmId: candidate.toRealmId,
        offeredAt: Math.max(0, Math.floor(candidate.offeredAt)),
      })
    }
  }
  const peaceOffers: CampaignPeaceOffer[] = []
  if (Array.isArray(saved.peaceOffers)) {
    for (const candidate of saved.peaceOffers) {
      if (
        !candidate
        || typeof candidate.fromRealmId !== 'string'
        || typeof candidate.toRealmId !== 'string'
        || candidate.fromRealmId === candidate.toRealmId
        || !Number.isFinite(candidate.offeredAt)
        || peaceOffers.some((offer) => (
          [offer.fromRealmId, offer.toRealmId].includes(candidate.fromRealmId)
          && [offer.fromRealmId, offer.toRealmId].includes(candidate.toRealmId)
        ))
      ) continue
      const relation = relations.find((item) => (
        item.realmIds.includes(candidate.fromRealmId) && item.realmIds.includes(candidate.toRealmId)
      ))
      const demandedProvince = candidate.demandedProvinceId === null
        ? null
        : provinces.find((province) => province.id === candidate.demandedProvinceId)
      if (
        relation?.status !== 'war'
        || !realms.some((realm) => realm.id === candidate.fromRealmId && realm.status === 'active')
        || !realms.some((realm) => realm.id === candidate.toRealmId && realm.status === 'active')
        || (candidate.demandedProvinceId !== null && !demandedProvince)
      ) continue
      peaceOffers.push({
        fromRealmId: candidate.fromRealmId,
        toRealmId: candidate.toRealmId,
        demandedProvinceId: demandedProvince?.id ?? null,
        offeredAt: Math.max(0, Math.floor(candidate.offeredAt)),
      })
    }
  }
  const tradeRoutes: CampaignTradeRoute[] = []
  if (Array.isArray(saved.tradeRoutes)) {
    for (const candidate of saved.tradeRoutes) {
      if (
        !candidate
        || typeof candidate.id !== 'string'
        || candidate.id.length < 1
        || candidate.id.length > 64
        || !Array.isArray(candidate.realmIds)
        || candidate.realmIds.length !== 2
        || candidate.realmIds[0] === candidate.realmIds[1]
        || !Array.isArray(candidate.provinceIds)
        || candidate.provinceIds.length !== 2
        || !Number.isFinite(candidate.openedAt)
        || tradeRoutes.some((route) => route.id === candidate.id)
      ) continue
      const leftRealm = realms.find((realm) => realm.id === candidate.realmIds[0] && realm.status === 'active')
      const rightRealm = realms.find((realm) => realm.id === candidate.realmIds[1] && realm.status === 'active')
      const leftProvince = provinces.find((province) => province.id === candidate.provinceIds[0])
      const rightProvince = provinces.find((province) => province.id === candidate.provinceIds[1])
      const relation = relations.find((item) => (
        item.realmIds.includes(candidate.realmIds[0]) && item.realmIds.includes(candidate.realmIds[1])
      ))
      if (
        !leftRealm
        || !rightRealm
        || !leftProvince
        || !rightProvince
        || leftProvince.owner !== leftRealm.id
        || rightProvince.owner !== rightRealm.id
        || leftProvince.marketLevel < 1
        || rightProvince.marketLevel < 1
        || !provincesAreAdjacent(leftProvince, rightProvince)
        || relation?.status === 'war'
        || (relation?.tradeEmbargoes.length ?? 0) > 0
        || tradeRoutes.some((route) => (
          route.realmIds.includes(leftRealm.id) && route.realmIds.includes(rightRealm.id)
        ))
      ) continue
      tradeRoutes.push({
        id: candidate.id,
        realmIds: [leftRealm.id, rightRealm.id],
        provinceIds: [leftProvince.id, rightProvince.id],
        openedAt: Math.max(0, Math.floor(candidate.openedAt)),
      })
    }
  }
  const marches = Array.isArray(saved.marches)
    ? saved.marches.filter((march) => (
        typeof march?.id === 'string'
        && baseline.realms.some((realm) => realm.id === march.actorId)
        && baseline.provinces.some((province) => province.id === march.sourceId)
        && baseline.provinces.some((province) => province.id === march.targetId)
        && Number.isFinite(march.soldiers)
        && march.soldiers > 0
        && Number.isFinite(march.departedAt)
        && Number.isFinite(march.arrivesAt)
        && march.arrivesAt >= march.departedAt
      )).map((march) => {
        const source = provinces.find((province) => province.id === march.sourceId)
        return {
          ...march,
          kind: march.kind === 'support' ? 'support' as const : 'attack' as const,
          route: storedMarchRoute(provinces, march),
          siegeId: typeof march.siegeId === 'string' && march.siegeId.length <= 64
            ? march.siegeId
            : undefined,
          formation: FORMATION_SHAPES.includes(march.formation) ? march.formation : 'line',
          supplies: Number.isFinite(march.supplies)
            ? Math.max(0, Math.floor(march.supplies!))
            : source
              ? campaignArmySupplies(source)
              : 6,
          engines: Number.isFinite(march.engines) ? Math.max(0, Math.min(2, Math.floor(march.engines!))) : 0,
        }
      })
    : []
  const sieges: CampaignSiege[] = []
  if (Array.isArray(saved.sieges)) {
    for (const candidate of saved.sieges) {
      if (
        !candidate
        || typeof candidate.id !== 'string'
        || candidate.id.length < 1
        || candidate.id.length > 64
        || typeof candidate.attackerId !== 'string'
        || typeof candidate.defenderId !== 'string'
        || candidate.attackerId === candidate.defenderId
        || !Number.isInteger(candidate.sourceId)
        || !Number.isInteger(candidate.targetId)
        || !Number.isFinite(candidate.soldiers)
        || candidate.soldiers < 1
        || !FORMATION_SHAPES.includes(candidate.formation)
        || !['blockade', 'sappers', 'assault'].includes(candidate.tactic)
        || !Number.isFinite(candidate.progress)
        || !Number.isFinite(candidate.startedAt)
        || !Number.isFinite(candidate.lastResolvedAt)
        || sieges.some((siege) => siege.id === candidate.id || siege.targetId === candidate.targetId)
      ) continue
      const attacker = realms.find((realm) => realm.id === candidate.attackerId && realm.status === 'active')
      const defender = realms.find((realm) => realm.id === candidate.defenderId && realm.status === 'active')
      const source = provinces.find((province) => province.id === candidate.sourceId)
      const target = provinces.find((province) => province.id === candidate.targetId)
      const relation = relations.find((item) => (
        item.realmIds.includes(candidate.attackerId) && item.realmIds.includes(candidate.defenderId)
      ))
      if (
        !attacker
        || !defender
        || !source
        || !target
        || target.owner !== defender.id
        || target.fortificationLevel < 1
        || relation?.status !== 'war'
      ) continue
      sieges.push({
        id: candidate.id,
        attackerId: attacker.id,
        defenderId: defender.id,
        sourceId: source.id,
        targetId: target.id,
        soldiers: Math.max(1, Math.floor(candidate.soldiers)),
        formation: candidate.formation,
        tactic: candidate.tactic,
        progress: Math.max(0, Math.min(99, Math.floor(candidate.progress))),
        supplies: Number.isFinite(candidate.supplies) ? Math.max(0, Math.floor(candidate.supplies!)) : 6,
        engines: Number.isFinite(candidate.engines)
          ? Math.max(0, Math.min(2, Math.floor(candidate.engines!)))
          : 0,
        startedAt: Math.max(0, Math.floor(candidate.startedAt)),
        lastResolvedAt: Math.max(0, Math.floor(candidate.lastResolvedAt)),
      })
    }
  }

  return {
    playerRealmId: baseline.realms.some((realm) => realm.id === saved.playerRealmId)
      ? saved.playerRealmId!
      : baseline.playerRealmId,
    tick: Number.isFinite(saved.tick) ? Math.max(0, Math.floor(saved.tick ?? 0)) : 0,
    realms,
    economies,
    relations,
    allianceOffers,
    peaceOffers,
    tradeRoutes,
    sieges,
    provinces,
    marches,
    winnerRealmId: baseline.realms.some((realm) => realm.id === saved.winnerRealmId)
      ? saved.winnerRealmId!
      : null,
  }
}

function provinceLevel(value: unknown, fallback: ProvinceLevel): ProvinceLevel {
  return value === 0 || value === 1 || value === 2 ? value : fallback
}

export function campaignActionBlockReason(campaign: CampaignState, actorRealmId: RealmId): string | null {
  if (campaign.winnerRealmId) return 'Матч уже завершён'
  const realm = campaign.realms.find((item) => item.id === actorRealmId)
  if (!realm) return 'Держава не найдена'
  return realm.status === 'defeated' ? 'Держава разгромлена; доступен только обзор карты' : null
}

export function campaignProvinceAt(campaign: CampaignState, point: { x: number; y: number }): Province | null {
  const column = Math.max(0, Math.min(7, Math.floor(point.x / 8)))
  const row = Math.max(0, Math.min(7, Math.floor(point.y / 8)))
  return campaign.provinces.find((province) => province.column === column && province.row === row) ?? null
}

export function campaignProvinceCenter(province: Province): { x: number; y: number } {
  return { x: province.column * 8 + 4, y: province.row * 8 + 4 }
}

export function provincesAreAdjacent(left: Province, right: Province): boolean {
  return Math.abs(left.column - right.column) + Math.abs(left.row - right.row) === 1
}

export function campaignMarchRoute(
  campaign: CampaignState,
  sourceId: number,
  targetId: number,
  actorRealmId: RealmId = campaign.playerRealmId,
): number[] | null {
  const source = campaign.provinces.find((province) => province.id === sourceId)
  const target = campaign.provinces.find((province) => province.id === targetId)
  if (!source || !target || source.id === target.id || source.owner !== actorRealmId) return null

  const visited = new Set<number>([source.id])
  const previous = new Map<number, number>()
  const pending = [source]
  while (pending.length > 0) {
    const province = pending.shift()!
    const neighbors = campaign.provinces
      .filter((candidate) => (
        !visited.has(candidate.id)
        && provincesAreAdjacent(province, candidate)
        && (candidate.id === target.id || candidate.owner === actorRealmId)
      ))
      .sort((left, right) => left.id - right.id)
    for (const neighbor of neighbors) {
      visited.add(neighbor.id)
      previous.set(neighbor.id, province.id)
      if (neighbor.id === target.id) {
        const route = [target.id]
        let cursor = target.id
        while (cursor !== source.id) {
          cursor = previous.get(cursor)!
          route.push(cursor)
        }
        return route.reverse()
      }
      pending.push(neighbor)
    }
  }
  return null
}

function storedMarchRoute(
  provinces: readonly Province[],
  march: Pick<CampaignMarch, 'sourceId' | 'targetId'> & { route?: unknown },
): number[] {
  if (!Array.isArray(march.route)) return [march.sourceId, march.targetId]
  const route = march.route.filter((provinceId): provinceId is number => (
    Number.isInteger(provinceId) && provinces.some((province) => province.id === provinceId)
  ))
  if (
    route.length < 2
    || route[0] !== march.sourceId
    || route.at(-1) !== march.targetId
    || route.some((provinceId, index) => {
      if (index === 0) return false
      const previous = provinces.find((province) => province.id === route[index - 1])
      const current = provinces.find((province) => province.id === provinceId)
      return !previous || !current || !provincesAreAdjacent(previous, current)
    })
  ) {
    return [march.sourceId, march.targetId]
  }
  return route
}

export function campaignRelation(
  campaign: CampaignState,
  realmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): DiplomaticRelation | null {
  if (realmId === actorRealmId) return null
  return campaign.relations.find((relation) => (
    relation.realmIds.includes(realmId) && relation.realmIds.includes(actorRealmId)
  )) ?? null
}

export function allianceOfferBetween(
  campaign: CampaignState,
  leftRealmId: RealmId,
  rightRealmId: RealmId,
): AllianceOffer | null {
  return campaign.allianceOffers.find((offer) => (
    [offer.fromRealmId, offer.toRealmId].includes(leftRealmId)
    && [offer.fromRealmId, offer.toRealmId].includes(rightRealmId)
  )) ?? null
}

function clearAllianceOffersBetween(
  campaign: CampaignState,
  leftRealmId: RealmId,
  rightRealmId: RealmId,
): void {
  campaign.allianceOffers = campaign.allianceOffers.filter((offer) => !(
    [offer.fromRealmId, offer.toRealmId].includes(leftRealmId)
    && [offer.fromRealmId, offer.toRealmId].includes(rightRealmId)
  ))
}

function clearPeaceOffersBetween(campaign: CampaignState, leftId: RealmId, rightId: RealmId): void {
  campaign.peaceOffers = campaign.peaceOffers.filter((offer) => !(
    [offer.fromRealmId, offer.toRealmId].includes(leftId)
    && [offer.fromRealmId, offer.toRealmId].includes(rightId)
  ))
}

export function campaignPeaceOfferBetween(
  campaign: CampaignState,
  leftRealmId: RealmId,
  rightRealmId: RealmId,
): CampaignPeaceOffer | null {
  return campaign.peaceOffers.find((offer) => (
    [offer.fromRealmId, offer.toRealmId].includes(leftRealmId)
    && [offer.fromRealmId, offer.toRealmId].includes(rightRealmId)
  )) ?? null
}

export function campaignWarScore(
  campaign: CampaignState,
  targetRealmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): number {
  const occupation = campaign.provinces.reduce((score, province) => {
    const value = province.homelandCapitalOf ? 25 : 10
    if (province.homelandOf === targetRealmId && province.owner === actorRealmId) return score + value
    if (province.homelandOf === actorRealmId && province.owner === targetRealmId) return score - value
    return score
  }, 0)
  const actorStrength = realmStrength(campaign, actorRealmId)
  const targetStrength = realmStrength(campaign, targetRealmId)
  const strengthEdge = Math.round((actorStrength - targetStrength) / Math.max(1, actorStrength + targetStrength) * 40)
  return Math.max(-100, Math.min(100, occupation + Math.max(-20, Math.min(20, strengthEdge))))
}

export function campaignPeaceDemandCandidates(
  campaign: CampaignState,
  targetRealmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): Province[] {
  return campaign.provinces
    .filter((province) => province.owner === targetRealmId && province.capitalOf !== targetRealmId)
    .filter((province) => campaign.provinces.some((neighbor) => (
      neighbor.owner === actorRealmId && provincesAreAdjacent(neighbor, province)
    )))
    .sort((left, right) => left.id - right.id)
}

export function realmStrength(campaign: CampaignState, realmId: RealmId): number {
  const garrisons = campaign.provinces
    .filter((province) => province.owner === realmId)
    .reduce((total, province) => total + province.levies, 0)
  const fieldArmies = campaign.marches
    .filter((march) => march.actorId === realmId)
    .reduce((total, march) => total + march.soldiers, 0)
  const besiegers = campaign.sieges
    .filter((siege) => siege.attackerId === realmId)
    .reduce((total, siege) => total + siege.soldiers, 0)
  return garrisons + fieldArmies + besiegers
}

export function realmEconomy(campaign: CampaignState, realmId: RealmId): RealmEconomy | null {
  return campaign.economies.find((economy) => economy.realmId === realmId) ?? null
}

export function tradeRouteBetweenRealms(
  campaign: CampaignState,
  leftRealmId: RealmId,
  rightRealmId: RealmId,
): CampaignTradeRoute | null {
  return campaign.tradeRoutes.find((route) => (
    route.realmIds.includes(leftRealmId) && route.realmIds.includes(rightRealmId)
  )) ?? null
}

export function tradeRouteIncome(campaign: CampaignState, route: CampaignTradeRoute): number {
  const [leftId, rightId] = route.provinceIds
  const left = campaign.provinces.find((province) => province.id === leftId)
  const right = campaign.provinces.find((province) => province.id === rightId)
  if (!left || !right) return 0
  return 2 + left.marketLevel * 2 + right.marketLevel * 2
}

export function realmDailyIncome(campaign: CampaignState, realmId: RealmId): number {
  const domainIncome = campaign.provinces
    .filter((province) => province.owner === realmId)
    .reduce((income, province) => income + 1 + province.cityLevel + province.marketLevel * 2, 0)
  const tradeIncome = campaign.tradeRoutes
    .filter((route) => route.realmIds.includes(realmId))
    .reduce((income, route) => income + tradeRouteIncome(campaign, route), 0)
  return domainIncome + tradeIncome
}

function clearTradeRoutesBetween(
  campaign: CampaignState,
  leftRealmId: RealmId,
  rightRealmId: RealmId,
): number {
  const before = campaign.tradeRoutes.length
  campaign.tradeRoutes = campaign.tradeRoutes.filter((route) => !(
    route.realmIds.includes(leftRealmId) && route.realmIds.includes(rightRealmId)
  ))
  return before - campaign.tradeRoutes.length
}

export function openTradeRoute(
  campaign: CampaignState,
  sourceId: number,
  targetId: number,
  actorRealmId: RealmId = campaign.playerRealmId,
  routeId = `trade:${actorRealmId}:${sourceId}:${targetId}:${campaign.tick}`,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const source = campaign.provinces.find((province) => province.id === sourceId)
  const target = campaign.provinces.find((province) => province.id === targetId)
  if (!source || !target) return { ok: false, reason: 'Провинция не найдена' }
  if (source.owner !== actorRealmId) return { ok: false, reason: 'Торговый путь должен выйти из вашей провинции' }
  if (!target.owner || target.owner === actorRealmId) return { ok: false, reason: 'Выберите рынок другой державы' }
  const relation = campaignRelation(campaign, target.owner, actorRealmId)
  if (!relation) return { ok: false, reason: 'Держава не найдена' }
  if (relation.status === 'war') return { ok: false, reason: 'Во время войны торговля закрыта' }
  if (relation.tradeEmbargoes.length > 0) return { ok: false, reason: 'Торговлю блокирует эмбарго' }
  if (!provincesAreAdjacent(source, target)) return { ok: false, reason: 'Караванам нужна общая граница провинций' }
  if (source.marketLevel < 1) return { ok: false, reason: 'В исходной провинции сначала учредите торг' }
  if (target.marketLevel < 1) return { ok: false, reason: 'В соседней провинции нет торга' }
  if (tradeRouteBetweenRealms(campaign, actorRealmId, target.owner)) {
    return { ok: false, reason: 'Между державами уже действует торговый путь' }
  }
  if (!routeId || routeId.length > 64 || campaign.tradeRoutes.some((route) => route.id === routeId)) {
    return { ok: false, reason: 'Торговый путь задан неверно' }
  }
  const route: CampaignTradeRoute = {
    id: routeId,
    realmIds: [actorRealmId, target.owner],
    provinceIds: [source.id, target.id],
    openedAt: campaign.tick,
  }
  campaign.tradeRoutes.push(route)
  return {
    ok: true,
    message: `${source.name} — ${target.name}: открыт караванный путь +${tradeRouteIncome(campaign, route)} каждой казне в день`,
  }
}

export function setTradeEmbargo(
  campaign: CampaignState,
  realmId: RealmId,
  embargoed: boolean,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const relation = campaignRelation(campaign, realmId, actorRealmId)
  if (!relation) return { ok: false, reason: 'Держава не найдена' }
  const existing = relation.tradeEmbargoes.includes(actorRealmId)
  if (embargoed === existing) {
    return {
      ok: false,
      reason: embargoed ? 'Вы уже остановили торговлю с этой державой' : 'Вашего эмбарго нет',
    }
  }
  if (embargoed) {
    relation.tradeEmbargoes.push(actorRealmId)
    const closed = clearTradeRoutesBetween(campaign, actorRealmId, realmId)
    return {
      ok: true,
      message: closed > 0 ? 'Торговый путь закрыт; введено эмбарго' : 'Введено торговое эмбарго',
    }
  }
  relation.tradeEmbargoes = relation.tradeEmbargoes.filter((id) => id !== actorRealmId)
  return { ok: true, message: 'Торговое эмбарго снято' }
}

export function campaignSiegeAt(campaign: CampaignState, provinceId: number): CampaignSiege | null {
  return campaign.sieges.find((siege) => siege.targetId === provinceId) ?? null
}

export function campaignSiegeDailyProgress(
  campaign: CampaignState,
  siege: CampaignSiege,
  tactic: CampaignSiegeTactic = siege.tactic,
): number {
  if (tactic === 'assault') return 0
  const target = campaign.provinces.find((province) => province.id === siege.targetId)
  if (!target) return 0
  const resistance = target.cityLevel * 2 + target.marketLevel * 2 + target.fortificationLevel * 4
  const engineBonus = tactic === 'sappers' ? (siege.engines ?? 0) * 8 : 0
  return Math.max(8, (tactic === 'sappers' ? 40 : 24) + engineBonus - resistance)
}

export function campaignArmySupplies(source: Province): number {
  return 6 + source.cityLevel * 3 + source.marketLevel * 3
}

export function campaignSiegeDailySupplyCost(siege: Pick<CampaignSiege, 'soldiers'>): number {
  return Math.max(1, Math.ceil(siege.soldiers / 60))
}

export function campaignSiegeSupplyDays(siege: Pick<CampaignSiege, 'soldiers' | 'supplies'>): number {
  return Math.floor((siege.supplies ?? 0) / campaignSiegeDailySupplyCost(siege))
}

export function campaignSiegeProjectedDailyProgress(
  campaign: CampaignState,
  siege: CampaignSiege,
  tactic: CampaignSiegeTactic,
): number {
  const fullProgress = campaignSiegeDailyProgress(campaign, siege, tactic)
  return (siege.supplies ?? 0) < campaignSiegeDailySupplyCost(siege)
    ? Math.max(1, Math.floor(fullProgress / 2))
    : fullProgress
}

export function setSiegeTactic(
  campaign: CampaignState,
  siegeId: string,
  tactic: CampaignSiegeTactic,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const siege = campaign.sieges.find((item) => item.id === siegeId)
  if (!siege || siege.attackerId !== actorRealmId) {
    return { ok: false, reason: 'Только осаждающий правитель выбирает способ осады' }
  }
  if (!['blockade', 'sappers', 'assault'].includes(tactic)) {
    return { ok: false, reason: 'Такой способ осады не поддерживается' }
  }
  if (siege.tactic === tactic) return { ok: false, reason: 'Этот способ осады уже выбран' }
  if (tactic === 'sappers' && (realmEconomy(campaign, actorRealmId)?.silver ?? 0) < CAMPAIGN_SAPPER_DAILY_COST) {
    return { ok: false, reason: `Для подкопа нужно хотя бы ${CAMPAIGN_SAPPER_DAILY_COST} номисм` }
  }
  siege.tactic = tactic
  return {
    ok: true,
    message: tactic === 'assault'
      ? 'Рать готовится к решающему штурму на рассвете'
      : `Осадный приказ изменён: ${CAMPAIGN_SIEGE_TACTICS[tactic].label.toLowerCase()}`,
  }
}

function returnSiegeArmy(campaign: CampaignState, siege: CampaignSiege, soldiers: number): number {
  const source = campaign.provinces.find((province) => (
    province.id === siege.sourceId && province.owner === siege.attackerId
  ))
  if (!source || soldiers < 1) return 0
  const returned = Math.min(soldiers, Math.max(0, 300 - source.levies))
  source.levies += returned
  return returned
}

export function retreatSiege(
  campaign: CampaignState,
  siegeId: string,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const index = campaign.sieges.findIndex((siege) => siege.id === siegeId && siege.attackerId === actorRealmId)
  if (index < 0) return { ok: false, reason: 'Осадный лагерь не найден' }
  const siege = campaign.sieges[index]
  const casualties = Math.max(1, Math.ceil(siege.soldiers * CAMPAIGN_SIEGE_RETREAT_LOSS))
  const returned = returnSiegeArmy(campaign, siege, Math.max(0, siege.soldiers - casualties))
  campaign.sieges.splice(index, 1)
  return {
    ok: true,
    message: `Осада снята · вернулись ${returned}, потери при отходе ${casualties}`,
  }
}

export function sortieSiege(
  campaign: CampaignState,
  siegeId: string,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const index = campaign.sieges.findIndex((siege) => siege.id === siegeId && siege.defenderId === actorRealmId)
  if (index < 0) return { ok: false, reason: 'Осада этой провинции не найдена' }
  const siege = campaign.sieges[index]
  const target = campaign.provinces.find((province) => province.id === siege.targetId && province.owner === actorRealmId)
  if (!target) return { ok: false, reason: 'Осаждённая провинция больше не принадлежит державе' }
  if (target.levies < 8) return { ok: false, reason: 'Для вылазки в гарнизоне нужно хотя бы 8 ратников' }

  const committed = Math.max(4, Math.floor(target.levies / 2))
  const modifier = formationMatchupModifier(target.defenseFormation, siege.formation)
  const sortieStrength = Math.round(committed * (1 + modifier))
  if (sortieStrength > siege.soldiers) {
    const defenderLosses = Math.min(committed - 1, Math.max(1, Math.ceil(siege.soldiers * 0.55)))
    target.levies -= defenderLosses
    campaign.sieges.splice(index, 1)
    return {
      ok: true,
      message: `${target.name}: вылазка уничтожила осадный лагерь · потери гарнизона ${defenderLosses}`,
    }
  }

  const attackerLosses = Math.min(siege.soldiers - 1, Math.max(1, Math.ceil(committed * 0.55)))
  target.levies = Math.max(1, target.levies - committed)
  siege.soldiers -= attackerLosses
  siege.progress = Math.min(99, siege.progress + 10)
  return {
    ok: true,
    message: `${target.name}: вылазка отбита · гарнизон потерял ${committed}, осаждающие ${attackerLosses}`,
  }
}

function liftSiegesBetween(campaign: CampaignState, leftId: RealmId, rightId: RealmId): number {
  const lifted = campaign.sieges.filter((siege) => (
    [siege.attackerId, siege.defenderId].includes(leftId)
    && [siege.attackerId, siege.defenderId].includes(rightId)
  ))
  for (const siege of lifted) returnSiegeArmy(campaign, siege, siege.soldiers)
  const liftedIds = new Set(lifted.map((siege) => siege.id))
  campaign.sieges = campaign.sieges.filter((siege) => !liftedIds.has(siege.id))
  return lifted.length
}

export function provinceLevyCap(province: Province): number {
  return 120 + province.cityLevel * 30
}

export function provinceProjectLevel(province: Province, kind: ProvinceProjectKind): ProvinceLevel {
  if (kind === 'settlement') return province.cityLevel
  if (kind === 'market') return province.marketLevel
  if (kind === 'fortification') return province.fortificationLevel
  return province.workshopLevel
}

export function musterProvince(
  campaign: CampaignState,
  provinceId: number,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const province = campaign.provinces.find((item) => item.id === provinceId)
  const economy = realmEconomy(campaign, actorRealmId)
  if (!province || province.owner !== actorRealmId) return { ok: false, reason: 'Для сбора выберите свою провинцию' }
  if (campaignSiegeAt(campaign, provinceId)) return { ok: false, reason: 'В осаждённой провинции нельзя провести новый сбор' }
  if (!economy) return { ok: false, reason: 'Казна державы не найдена' }
  if (economy.silver < CAMPAIGN_MUSTER_COST) {
    return { ok: false, reason: `Для сбора нужно ${CAMPAIGN_MUSTER_COST} номисм` }
  }
  const levyCap = provinceLevyCap(province)
  if (province.levies >= levyCap) return { ok: false, reason: 'Ополчение провинции уже собрано полностью' }
  const raised = Math.min(levyCap - province.levies, 12 + province.cityLevel * 4)
  economy.silver -= CAMPAIGN_MUSTER_COST
  province.levies += raised
  return { ok: true, message: `${province.name}: собрано ${raised} ратников` }
}

export function startProvinceProject(
  campaign: CampaignState,
  provinceId: number,
  kind: ProvinceProjectKind,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const province = campaign.provinces.find((item) => item.id === provinceId)
  const economy = realmEconomy(campaign, actorRealmId)
  if (!province || province.owner !== actorRealmId) return { ok: false, reason: 'Для развития выберите свою провинцию' }
  if (campaignSiegeAt(campaign, provinceId)) return { ok: false, reason: 'Строительство остановлено до снятия осады' }
  if (!economy) return { ok: false, reason: 'Казна державы не найдена' }
  if (province.project) return { ok: false, reason: 'В провинции уже идёт строительство' }
  const definition = PROVINCE_PROJECTS[kind]
  if (!definition) return { ok: false, reason: 'Такой проект не поддерживается' }
  if (provinceProjectLevel(province, kind) >= 2) return { ok: false, reason: 'Это владение уже развито до предела сценария' }
  if (economy.silver < definition.cost) {
    return { ok: false, reason: `Для проекта нужно ${definition.cost} номисм` }
  }
  economy.silver -= definition.cost
  province.project = {
    kind,
    startedAt: campaign.tick,
    completesAt: campaign.tick + definition.durationDays,
  }
  return {
    ok: true,
    message: `${province.name}: начат проект «${definition.label.toLowerCase()}» · ${definition.durationDays} дн.`,
  }
}

export function setProvinceDefenseFormation(
  campaign: CampaignState,
  provinceId: number,
  formation: FormationShape,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const province = campaign.provinces.find((item) => item.id === provinceId)
  if (!province || province.owner !== actorRealmId) {
    return { ok: false, reason: 'Для оборонного строя выберите свою провинцию' }
  }
  if (!FORMATION_SHAPES.includes(formation)) return { ok: false, reason: 'Такой строй не поддерживается' }
  if (
    campaignSiegeAt(campaign, provinceId)
    || campaign.marches.some((march) => march.targetId === provinceId && march.actorId !== actorRealmId)
  ) {
    return { ok: false, reason: 'Гарнизон уже встречает вражеский поход' }
  }
  province.defenseFormation = formation
  return { ok: true, message: `${province.name}: гарнизон перестроен` }
}

export function declareWar(
  campaign: CampaignState,
  realmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const relation = campaignRelation(campaign, realmId, actorRealmId)
  const economy = realmEconomy(campaign, actorRealmId)
  if (!relation) return { ok: false, reason: 'Держава не найдена' }
  if (!economy) return { ok: false, reason: 'Казна державы не найдена' }
  if (relation.status === 'war') return { ok: false, reason: 'Война уже идёт' }
  if (relation.status === 'truce') {
    return { ok: false, reason: `Перемирие действует ещё ${Math.max(1, (relation.truceUntil ?? campaign.tick + 1) - campaign.tick)} дн.` }
  }
  if (relation.status === 'alliance') return { ok: false, reason: 'Сначала разорвите союз' }
  if (economy.legitimacy < CAMPAIGN_WAR_LEGITIMACY_COST) {
    return { ok: false, reason: `Для объявления войны нужно ${CAMPAIGN_WAR_LEGITIMACY_COST} легитимности` }
  }
  relation.status = 'war'
  relation.opinion = Math.max(-100, relation.opinion - 35)
  relation.truceUntil = null
  clearAllianceOffersBetween(campaign, actorRealmId, realmId)
  clearPeaceOffersBetween(campaign, actorRealmId, realmId)
  clearTradeRoutesBetween(campaign, actorRealmId, realmId)
  economy.legitimacy -= CAMPAIGN_WAR_LEGITIMACY_COST
  return { ok: true, message: 'Гонцы передали объявление войны' }
}

function settlePeace(
  campaign: CampaignState,
  leftRealmId: RealmId,
  rightRealmId: RealmId,
  demandedProvinceId: number | null,
  beneficiaryRealmId: RealmId,
): CampaignCommandResult {
  const relation = campaignRelation(campaign, rightRealmId, leftRealmId)
  if (!relation || relation.status !== 'war') {
    return { ok: false, reason: 'Мир возможен только во время войны' }
  }
  let cededProvince: Province | null = null
  if (demandedProvinceId !== null) {
    const previousOwner = beneficiaryRealmId === leftRealmId ? rightRealmId : leftRealmId
    cededProvince = campaign.provinces.find((province) => (
      province.id === demandedProvinceId && province.owner === previousOwner
    )) ?? null
    if (!cededProvince || cededProvince.capitalOf === previousOwner) {
      return { ok: false, reason: 'Требуемая провинция больше не может быть уступлена' }
    }
    cededProvince.owner = beneficiaryRealmId
    cededProvince.levies = Math.max(4, Math.floor(cededProvince.levies / 2))
    registerConquest(campaign, cededProvince, previousOwner, beneficiaryRealmId)
  }
  relation.status = 'truce'
  relation.opinion = Math.max(-100, Math.min(100, relation.opinion + (cededProvince ? -5 : 10)))
  relation.truceUntil = campaign.tick + 12
  clearPeaceOffersBetween(campaign, leftRealmId, rightRealmId)
  const liftedSieges = liftSiegesBetween(campaign, leftRealmId, rightRealmId)
  return {
    ok: true,
    message: [
      cededProvince ? `${cededProvince.name} уступлена по мирному договору` : 'Заключён белый мир',
      'перемирие на 12 дней',
      liftedSieges > 0 ? `снято осад: ${liftedSieges}` : null,
    ].filter(Boolean).join(' · '),
  }
}

export function proposePeace(
  campaign: CampaignState,
  realmId: RealmId,
  demandedProvinceId: number | null = null,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const relation = campaignRelation(campaign, realmId, actorRealmId)
  if (!relation) return { ok: false, reason: 'Держава не найдена' }
  if (relation.status !== 'war') return { ok: false, reason: 'Мир можно предложить только во время войны' }
  if (campaignPeaceOfferBetween(campaign, actorRealmId, realmId)) {
    return { ok: false, reason: 'Мирные условия уже ожидают ответа' }
  }
  let demandedProvince: Province | null = null
  if (demandedProvinceId !== null) {
    if (campaignWarScore(campaign, realmId, actorRealmId) < CAMPAIGN_PEACE_DEMAND_SCORE) {
      return { ok: false, reason: `Для территориального требования нужен военный счёт ${CAMPAIGN_PEACE_DEMAND_SCORE}` }
    }
    demandedProvince = campaignPeaceDemandCandidates(campaign, realmId, actorRealmId)
      .find((province) => province.id === demandedProvinceId) ?? null
    if (!demandedProvince) return { ok: false, reason: 'Эту провинцию нельзя потребовать по текущим границам' }
  }
  campaign.peaceOffers.push({
    fromRealmId: actorRealmId,
    toRealmId: realmId,
    demandedProvinceId: demandedProvince?.id ?? null,
    offeredAt: campaign.tick,
  })
  return {
    ok: true,
    message: demandedProvince
      ? `Предложен мир с требованием уступить ${demandedProvince.name}`
      : 'Предложен белый мир без изменения границ',
  }
}

export function answerPeaceOffer(
  campaign: CampaignState,
  fromRealmId: RealmId,
  accept: boolean,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const offer = campaign.peaceOffers.find((candidate) => (
    candidate.fromRealmId === fromRealmId && candidate.toRealmId === actorRealmId
  ))
  if (!offer) return { ok: false, reason: 'Входящие мирные условия не найдены' }
  if (!accept) {
    clearPeaceOffersBetween(campaign, actorRealmId, fromRealmId)
    return { ok: true, message: 'Мирные условия отклонены' }
  }
  if (offer.demandedProvinceId !== null) {
    const score = campaignWarScore(campaign, actorRealmId, fromRealmId)
    const candidate = campaignPeaceDemandCandidates(campaign, actorRealmId, fromRealmId)
      .some((province) => province.id === offer.demandedProvinceId)
    if (score < CAMPAIGN_PEACE_DEMAND_SCORE || !candidate) {
      return { ok: false, reason: 'Территориальное требование больше не подтверждено ходом войны' }
    }
  }
  return settlePeace(campaign, fromRealmId, actorRealmId, offer.demandedProvinceId, fromRealmId)
}

export function withdrawPeaceOffer(
  campaign: CampaignState,
  toRealmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const offer = campaign.peaceOffers.find((candidate) => (
    candidate.fromRealmId === actorRealmId && candidate.toRealmId === toRealmId
  ))
  if (!offer) return { ok: false, reason: 'Исходящие мирные условия не найдены' }
  clearPeaceOffersBetween(campaign, actorRealmId, toRealmId)
  return { ok: true, message: 'Мирное посольство отозвано' }
}

export function offerTruce(
  campaign: CampaignState,
  realmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  return settlePeace(campaign, actorRealmId, realmId, null, actorRealmId)
}

export function sendGift(
  campaign: CampaignState,
  realmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const relation = campaignRelation(campaign, realmId, actorRealmId)
  const economy = realmEconomy(campaign, actorRealmId)
  if (!relation) return { ok: false, reason: 'Держава не найдена' }
  if (!economy) return { ok: false, reason: 'Казна державы не найдена' }
  if (relation.status === 'war') return { ok: false, reason: 'Во время войны дары не примут' }
  if (relation.status === 'alliance') return { ok: false, reason: 'Союзнику отправляйте помощь напрямую в казну' }
  if (economy.silver < CAMPAIGN_GIFT_COST) {
    return { ok: false, reason: `Для даров нужно ${CAMPAIGN_GIFT_COST} номисм` }
  }
  economy.silver -= CAMPAIGN_GIFT_COST
  relation.opinion = Math.min(100, relation.opinion + 25)
  return { ok: true, message: `Отношение улучшено до ${relation.opinion}` }
}

export function sendAllianceSilver(
  campaign: CampaignState,
  realmId: RealmId,
  amount: AllianceSilverAmount,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  if (!ALLIANCE_SILVER_AMOUNTS.includes(amount)) {
    return { ok: false, reason: 'Такой размер помощи не поддерживается' }
  }
  const relation = campaignRelation(campaign, realmId, actorRealmId)
  const sender = realmEconomy(campaign, actorRealmId)
  const recipient = realmEconomy(campaign, realmId)
  const recipientRealm = campaign.realms.find((realm) => realm.id === realmId && realm.status === 'active')
  if (!relation || !recipientRealm || !sender || !recipient) return { ok: false, reason: 'Держава не найдена' }
  if (relation.status !== 'alliance') return { ok: false, reason: 'Помощь казной доступна только союзнику' }
  if (sender.silver < amount) return { ok: false, reason: `Для помощи нужно ${amount} номисм` }
  if (recipient.silver > 9999 - amount) return { ok: false, reason: 'Союзная казна уже заполнена' }
  sender.silver -= amount
  recipient.silver += amount
  return { ok: true, message: `${recipientRealm.name} получает ${amount} номисм союзной помощи` }
}

export function formAlliance(
  campaign: CampaignState,
  realmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const relation = campaignRelation(campaign, realmId, actorRealmId)
  if (!relation) return { ok: false, reason: 'Держава не найдена' }
  if (relation.status !== 'neutral') return { ok: false, reason: 'Союз требует мира без действующего перемирия' }
  if (relation.opinion < 50) return { ok: false, reason: 'Для союза нужно отношение не ниже 50' }
  relation.status = 'alliance'
  relation.opinion = Math.min(100, relation.opinion + 10)
  clearAllianceOffersBetween(campaign, actorRealmId, realmId)
  return { ok: true, message: 'Клятвы союза принесены' }
}

export function offerAlliance(
  campaign: CampaignState,
  realmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const relation = campaignRelation(campaign, realmId, actorRealmId)
  const target = campaign.realms.find((realm) => realm.id === realmId)
  if (!relation || !target || target.status !== 'active') return { ok: false, reason: 'Держава не найдена' }
  if (relation.status !== 'neutral') return { ok: false, reason: 'Союз требует мира без действующего перемирия' }
  if (relation.opinion < 50) return { ok: false, reason: 'Для союза нужно отношение не ниже 50' }
  if (allianceOfferBetween(campaign, actorRealmId, realmId)) {
    return { ok: false, reason: 'Предложение союза уже ожидает ответа' }
  }
  campaign.allianceOffers.push({
    fromRealmId: actorRealmId,
    toRealmId: realmId,
    offeredAt: campaign.tick,
  })
  const actor = campaign.realms.find((realm) => realm.id === actorRealmId)
  return { ok: true, message: `${actor?.name ?? 'Соседняя держава'} предлагает союз` }
}

export function answerAllianceOffer(
  campaign: CampaignState,
  fromRealmId: RealmId,
  accept: boolean,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const offer = campaign.allianceOffers.find((candidate) => (
    candidate.fromRealmId === fromRealmId && candidate.toRealmId === actorRealmId
  ))
  if (!offer) return { ok: false, reason: 'Входящее предложение союза не найдено' }
  if (!accept) {
    clearAllianceOffersBetween(campaign, actorRealmId, fromRealmId)
    return { ok: true, message: 'Предложение союза отклонено' }
  }
  const result = formAlliance(campaign, fromRealmId, actorRealmId)
  if (!result.ok) return result
  const actor = campaign.realms.find((realm) => realm.id === actorRealmId)
  return { ok: true, message: `${actor?.name ?? 'Держава'} принимает союз` }
}

export function breakAlliance(
  campaign: CampaignState,
  realmId: RealmId,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const relation = campaignRelation(campaign, realmId, actorRealmId)
  if (!relation) return { ok: false, reason: 'Держава не найдена' }
  if (relation.status !== 'alliance') return { ok: false, reason: 'Союз не заключён' }
  relation.status = 'neutral'
  relation.opinion = Math.max(-100, relation.opinion - 40)
  clearAllianceOffersBetween(campaign, actorRealmId, realmId)
  const closedTradeRoutes = clearTradeRoutesBetween(campaign, actorRealmId, realmId)
  if (!relation.tradeEmbargoes.includes(actorRealmId)) relation.tradeEmbargoes.push(actorRealmId)
  return {
    ok: true,
    message: closedTradeRoutes > 0
      ? 'Союзные клятвы разорваны; торговля остановлена'
      : 'Союзные клятвы разорваны',
  }
}

export function attackProvince(
  campaign: CampaignState,
  sourceId: number,
  targetId: number,
  commitmentPercent: CampaignCommitment,
  actorRealmId: RealmId = campaign.playerRealmId,
  formation: FormationShape = 'line',
): CampaignAttackResult | CampaignAttackFailure {
  const context = campaignAttackContext(campaign, sourceId, targetId, commitmentPercent, actorRealmId)
  if (!context.ok) return context
  const { source, target, committed } = context
  const supplies = campaignArmySupplies(source)
  const engines = source.workshopLevel
  source.levies -= committed
  const siege = beginCommittedSiege(
    campaign,
    source.id,
    target,
    committed,
    actorRealmId,
    formation,
    `siege:${source.id}:${target.id}:${campaign.tick}`,
    supplies,
    engines,
  )
  if (siege) return siege
  return resolveCommittedAttack(campaign, target, committed, actorRealmId, formation)
}

function campaignAttackContext(
  campaign: CampaignState,
  sourceId: number,
  targetId: number,
  commitmentPercent: CampaignCommitment,
  actorRealmId: RealmId,
  routed = false,
): CampaignAttackFailure | { ok: true; source: Province; target: Province; route: number[]; committed: number } {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  if (!isCampaignCommitment(commitmentPercent)) {
    return { ok: false, reason: 'Доля похода должна быть от 10 до 90% с шагом 5%' }
  }
  const source = campaign.provinces.find((province) => province.id === sourceId)
  const target = campaign.provinces.find((province) => province.id === targetId)
  if (!source || !target) return { ok: false, reason: 'Провинция не найдена' }
  if (source.owner !== actorRealmId) return { ok: false, reason: 'Исходная провинция не принадлежит вашей державе' }
  if (campaignSiegeAt(campaign, source.id)) return { ok: false, reason: 'Осаждённый гарнизон не может начать поход' }
  if (target.owner === actorRealmId) return { ok: false, reason: 'Эта земля уже под вашим знаменем' }
  if (campaignSiegeAt(campaign, target.id)) return { ok: false, reason: 'Эта провинция уже находится в осаде' }
  const route = routed
    ? campaignMarchRoute(campaign, source.id, target.id, actorRealmId)
    : provincesAreAdjacent(source, target)
      ? [source.id, target.id]
      : null
  if (!route) {
    return {
      ok: false,
      reason: routed ? 'К цели нет пути через ваши земли' : 'Для похода нужна общая граница',
    }
  }
  if (target.owner && campaignRelation(campaign, target.owner, actorRealmId)?.status !== 'war') {
    return { ok: false, reason: 'Для похода на державу сначала объявите войну' }
  }

  const committed = Math.max(1, Math.floor(source.levies * commitmentPercent / 100))
  if (source.levies - committed < 4) return { ok: false, reason: 'В провинции должен остаться гарнизон' }
  return { ok: true, source, target, route, committed }
}

function routedArrival(departedAt: number, oneLegArrival: number, route: readonly number[]): number {
  return departedAt + (oneLegArrival - departedAt) * Math.max(1, route.length - 1)
}

function beginCommittedSiege(
  campaign: CampaignState,
  sourceId: number,
  target: Province,
  committed: number,
  actorRealmId: RealmId,
  formation: FormationShape,
  siegeId: string,
  supplies: number,
  engines: number,
): CampaignSiegeStartResult | null {
  if (!target.owner || target.fortificationLevel < 1) return null
  const siege: CampaignSiege = {
    id: siegeId,
    attackerId: actorRealmId,
    defenderId: target.owner,
    sourceId,
    targetId: target.id,
    soldiers: committed,
    formation,
    tactic: 'blockade',
    progress: 0,
    supplies,
    engines,
    startedAt: campaign.tick,
    lastResolvedAt: campaign.tick,
  }
  campaign.sieges.push(siege)
  return {
    ok: true,
    outcome: 'besieged',
    committed,
    targetId: target.id,
    siege,
  }
}

function resolveCommittedAttack(
  campaign: CampaignState,
  target: Province,
  committed: number,
  actorRealmId: RealmId,
  formation: FormationShape,
): CampaignResolvedAttackResult {
  const defenseFormation = target.defenseFormation
  const formationModifier = formationMatchupModifier(formation, defenseFormation)
  const attackStrength = Math.round(committed * (1 + formationModifier))
  const defenseStrength = Math.round(target.levies * (1 + target.fortificationLevel * 0.25))
  const previousOwner = target.owner

  if (attackStrength > defenseStrength) {
    const attackerLosses = Math.min(committed - 3, Math.ceil(target.levies * 0.65))
    const defenderLosses = target.levies
    target.owner = actorRealmId
    target.levies = Math.max(3, committed - attackerLosses)
    target.defenseFormation = formation
    const conquest = registerConquest(campaign, target, previousOwner, actorRealmId)
    return {
      ok: true,
      outcome: 'captured',
      committed,
      attackerLosses,
      defenderLosses,
      targetId: target.id,
      previousOwner,
      formation,
      defenseFormation,
      formationModifier,
      attackStrength,
      defenseStrength,
      ...conquest,
    }
  }

  const defenderLosses = Math.min(target.levies - 1, Math.max(1, Math.round(committed * 0.55)))
  target.levies -= defenderLosses
  return {
    ok: true,
    outcome: 'repelled',
    committed,
    attackerLosses: committed,
    defenderLosses,
    targetId: target.id,
    previousOwner,
    formation,
    defenseFormation,
    formationModifier,
    attackStrength,
    defenseStrength,
    capitalCaptured: false,
    defeatedRealmId: null,
    winnerRealmId: null,
  }
}

function registerConquest(
  campaign: CampaignState,
  target: Province,
  previousOwner: RealmId | null,
  actorRealmId: RealmId,
): Pick<CampaignResolvedAttackResult, 'capitalCaptured' | 'defeatedRealmId' | 'winnerRealmId'> {
  campaign.tradeRoutes = campaign.tradeRoutes.filter((route) => !route.provinceIds.includes(target.id))
  const displacedSieges = campaign.sieges.filter((siege) => siege.targetId === target.id)
  for (const siege of displacedSieges) returnSiegeArmy(campaign, siege, siege.soldiers)
  campaign.sieges = campaign.sieges.filter((siege) => siege.targetId !== target.id)
  if (!previousOwner || previousOwner === actorRealmId) {
    return { capitalCaptured: false, defeatedRealmId: null, winnerRealmId: campaign.winnerRealmId }
  }

  const capitalCaptured = target.capitalOf === previousOwner
  const remaining = campaign.provinces.filter((province) => province.owner === previousOwner)
  if (capitalCaptured) {
    const defenderEconomy = realmEconomy(campaign, previousOwner)
    const attackerEconomy = realmEconomy(campaign, actorRealmId)
    const loot = Math.min(CAMPAIGN_CAPITAL_LOOT, defenderEconomy?.silver ?? 0)
    if (defenderEconomy) {
      defenderEconomy.silver -= loot
      defenderEconomy.legitimacy = Math.max(0, defenderEconomy.legitimacy - 15)
    }
    if (attackerEconomy) {
      attackerEconomy.silver = Math.min(9999, attackerEconomy.silver + loot)
      attackerEconomy.legitimacy = Math.min(100, attackerEconomy.legitimacy + 6)
    }
    target.capitalOf = null
    if (remaining.length > 0) {
      const replacement = [...remaining].sort((left, right) => (
        right.cityLevel - left.cityLevel
        || right.levies - left.levies
        || left.id - right.id
      ))[0]
      replacement.capitalOf = previousOwner
    }
  }

  if (remaining.length > 0) {
    return { capitalCaptured, defeatedRealmId: null, winnerRealmId: campaign.winnerRealmId }
  }

  const defeatedRealm = campaign.realms.find((realm) => realm.id === previousOwner)
  if (defeatedRealm) {
    defeatedRealm.status = 'defeated'
    defeatedRealm.defeatedAt = campaign.tick
    defeatedRealm.defeatedBy = actorRealmId
  }
  campaign.marches = campaign.marches.filter((march) => march.actorId !== previousOwner)
  campaign.sieges = campaign.sieges.filter((siege) => (
    siege.attackerId !== previousOwner && siege.defenderId !== previousOwner
  ))
  campaign.tradeRoutes = campaign.tradeRoutes.filter((route) => !route.realmIds.includes(previousOwner))
  campaign.allianceOffers = campaign.allianceOffers.filter((offer) => (
    offer.fromRealmId !== previousOwner && offer.toRealmId !== previousOwner
  ))
  campaign.peaceOffers = campaign.peaceOffers.filter((offer) => (
    offer.fromRealmId !== previousOwner && offer.toRealmId !== previousOwner
  ))
  const survivors = campaign.realms.filter((realm) => (
    realm.status === 'active' && campaign.provinces.some((province) => province.owner === realm.id)
  ))
  if (survivors.length === 1) {
    campaign.winnerRealmId = survivors[0].id
    campaign.marches = []
    campaign.sieges = []
  }
  return {
    capitalCaptured,
    defeatedRealmId: previousOwner,
    winnerRealmId: campaign.winnerRealmId,
  }
}

export function beginCampaignMarch(
  campaign: CampaignState,
  order: {
    id: string
    actorId: RealmId
    sourceId: number
    targetId: number
    commitmentPercent: CampaignCommitment
    formation: FormationShape
    departedAt: number
    arrivesAt: number
  },
): CampaignMarchOrderResult {
  if (campaign.marches.some((march) => march.actorId === order.actorId && march.sourceId === order.sourceId)) {
    return { ok: false, reason: 'Из этой провинции уже выступило войско' }
  }
  if (!order.id || !Number.isFinite(order.departedAt) || !Number.isFinite(order.arrivesAt) || order.arrivesAt <= order.departedAt) {
    return { ok: false, reason: 'Срок похода задан неверно' }
  }
  if (!FORMATION_SHAPES.includes(order.formation)) return { ok: false, reason: 'Такой строй не поддерживается' }
  const context = campaignAttackContext(
    campaign,
    order.sourceId,
    order.targetId,
    order.commitmentPercent,
    order.actorId,
    true,
  )
  if (!context.ok) return context
  context.source.levies -= context.committed
  const march: CampaignMarch = {
    id: order.id,
    kind: 'attack',
    actorId: order.actorId,
    sourceId: order.sourceId,
    targetId: order.targetId,
    route: context.route,
    soldiers: context.committed,
    formation: order.formation,
    supplies: campaignArmySupplies(context.source),
    engines: context.source.workshopLevel,
    departedAt: order.departedAt,
    arrivesAt: routedArrival(order.departedAt, order.arrivesAt, context.route),
  }
  campaign.marches.push(march)
  return {
    ok: true,
    message: `${march.soldiers} ратников выступили в поход · ${march.route.length - 1} перехода`,
    march,
  }
}

export function campaignSiegeMarchRole(
  campaign: CampaignState,
  siege: CampaignSiege,
  actorRealmId: RealmId,
): CampaignSiegeMarchRole | null {
  if (siege.attackerId === actorRealmId) return 'reinforce'
  if (siege.defenderId === actorRealmId) return 'relief'
  const defenderAlliance = campaignRelation(campaign, siege.defenderId, actorRealmId)
  const attackerRelation = campaignRelation(campaign, siege.attackerId, actorRealmId)
  return defenderAlliance?.status === 'alliance' && attackerRelation?.status === 'war'
    ? 'relief'
    : null
}

export function beginSiegeMarch(
  campaign: CampaignState,
  order: {
    id: string
    siegeId: string
    actorId: RealmId
    sourceId: number
    commitmentPercent: CampaignCommitment
    formation: FormationShape
    departedAt: number
    arrivesAt: number
  },
): CampaignMarchOrderResult {
  const blocked = campaignActionBlockReason(campaign, order.actorId)
  if (blocked) return { ok: false, reason: blocked }
  if (!isCampaignCommitment(order.commitmentPercent)) {
    return { ok: false, reason: 'Доля похода должна быть от 10 до 90% с шагом 5%' }
  }
  if (campaign.marches.some((march) => (
    march.id === order.id
    || (march.actorId === order.actorId && march.sourceId === order.sourceId)
  ))) {
    return { ok: false, reason: 'Из этой провинции уже выступило войско' }
  }
  if (!order.id || !Number.isFinite(order.departedAt) || !Number.isFinite(order.arrivesAt) || order.arrivesAt <= order.departedAt) {
    return { ok: false, reason: 'Срок похода задан неверно' }
  }
  if (!FORMATION_SHAPES.includes(order.formation)) return { ok: false, reason: 'Такой строй не поддерживается' }
  const siege = campaign.sieges.find((item) => item.id === order.siegeId)
  if (!siege) return { ok: false, reason: 'Осада уже завершена' }
  const role = campaignSiegeMarchRole(campaign, siege, order.actorId)
  if (!role) return { ok: false, reason: 'Ваша держава не участвует в этой осаде' }
  const source = campaign.provinces.find((province) => province.id === order.sourceId)
  const target = campaign.provinces.find((province) => province.id === siege.targetId)
  if (!source || !target) return { ok: false, reason: 'Провинция не найдена' }
  if (source.owner !== order.actorId) return { ok: false, reason: 'Поход должен выйти из вашей провинции' }
  if (source.id === target.id) return { ok: false, reason: 'Осаждённый гарнизон может провести только вылазку' }
  if (!provincesAreAdjacent(source, target)) {
    return { ok: false, reason: 'Для манёвра нужна общая граница с осаждённой провинцией' }
  }
  if (campaignSiegeAt(campaign, source.id)) {
    return { ok: false, reason: 'Осаждённая провинция не может отправить полевую армию' }
  }
  const committed = Math.max(1, Math.floor(source.levies * order.commitmentPercent / 100))
  if (source.levies - committed < 4) return { ok: false, reason: 'В исходной провинции должен остаться гарнизон' }

  source.levies -= committed
  const march: CampaignMarch = {
    id: order.id,
    kind: role === 'reinforce' ? 'attack' : 'support',
    siegeId: siege.id,
    actorId: order.actorId,
    sourceId: source.id,
    targetId: target.id,
    route: [source.id, target.id],
    soldiers: committed,
    formation: order.formation,
    supplies: campaignArmySupplies(source),
    engines: role === 'reinforce' ? source.workshopLevel : 0,
    departedAt: order.departedAt,
    arrivesAt: order.arrivesAt,
  }
  campaign.marches.push(march)
  return {
    ok: true,
    message: role === 'reinforce'
      ? `${committed} ратников выступили усиливать осадный лагерь`
      : `${committed} ратников выступили снимать осаду`,
    march,
  }
}

function allianceSupportContext(
  campaign: CampaignState,
  sourceId: number,
  targetId: number,
  commitmentPercent: CampaignCommitment,
  actorRealmId: RealmId,
): CampaignAttackFailure | { ok: true; source: Province; target: Province; committed: number } {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  if (!isCampaignCommitment(commitmentPercent)) {
    return { ok: false, reason: 'Доля похода должна быть от 10 до 90% с шагом 5%' }
  }
  const source = campaign.provinces.find((province) => province.id === sourceId)
  const target = campaign.provinces.find((province) => province.id === targetId)
  if (!source || !target) return { ok: false, reason: 'Провинция не найдена' }
  if (source.owner !== actorRealmId) return { ok: false, reason: 'Подкрепление должно выйти из вашей провинции' }
  if (!target.owner || target.owner === actorRealmId) {
    return { ok: false, reason: 'Выберите провинцию союзной державы' }
  }
  if (campaignRelation(campaign, target.owner, actorRealmId)?.status !== 'alliance') {
    return { ok: false, reason: 'Подкрепления можно отправить только союзнику' }
  }
  if (!provincesAreAdjacent(source, target)) {
    return { ok: false, reason: 'Для подкрепления нужна общая граница провинций' }
  }
  const committed = Math.max(1, Math.floor(source.levies * commitmentPercent / 100))
  if (source.levies - committed < 4) return { ok: false, reason: 'В исходной провинции должен остаться гарнизон' }
  if (target.levies >= 300) return { ok: false, reason: 'Союзный гарнизон уже достиг предела' }
  return { ok: true, source, target, committed }
}

export function reinforceAllianceProvince(
  campaign: CampaignState,
  sourceId: number,
  targetId: number,
  commitmentPercent: CampaignCommitment,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const context = allianceSupportContext(campaign, sourceId, targetId, commitmentPercent, actorRealmId)
  if (!context.ok) return context
  const accepted = Math.min(context.committed, 300 - context.target.levies)
  context.source.levies -= accepted
  context.target.levies += accepted
  return { ok: true, message: `${context.target.name}: прибыло ${accepted} союзных ратников` }
}

export function beginAllianceSupportMarch(
  campaign: CampaignState,
  order: {
    id: string
    actorId: RealmId
    sourceId: number
    targetId: number
    commitmentPercent: CampaignCommitment
    formation: FormationShape
    departedAt: number
    arrivesAt: number
  },
): CampaignMarchOrderResult {
  if (campaign.marches.some((march) => march.actorId === order.actorId && march.sourceId === order.sourceId)) {
    return { ok: false, reason: 'Из этой провинции уже выступило войско' }
  }
  if (!order.id || !Number.isFinite(order.departedAt) || !Number.isFinite(order.arrivesAt) || order.arrivesAt <= order.departedAt) {
    return { ok: false, reason: 'Срок похода задан неверно' }
  }
  if (!FORMATION_SHAPES.includes(order.formation)) return { ok: false, reason: 'Такой строй не поддерживается' }
  const context = allianceSupportContext(
    campaign,
    order.sourceId,
    order.targetId,
    order.commitmentPercent,
    order.actorId,
  )
  if (!context.ok) return context
  context.source.levies -= context.committed
  const march: CampaignMarch = {
    id: order.id,
    kind: 'support',
    actorId: order.actorId,
    sourceId: order.sourceId,
    targetId: order.targetId,
    route: [order.sourceId, order.targetId],
    soldiers: context.committed,
    formation: order.formation,
    supplies: campaignArmySupplies(context.source),
    engines: 0,
    departedAt: order.departedAt,
    arrivesAt: order.arrivesAt,
  }
  campaign.marches.push(march)
  return { ok: true, message: `${march.soldiers} ратников выступили на помощь союзнику`, march }
}

export function recallCampaignMarch(
  campaign: CampaignState,
  marchId: string,
  actorRealmId: RealmId = campaign.playerRealmId,
): CampaignCommandResult {
  const blocked = campaignActionBlockReason(campaign, actorRealmId)
  if (blocked) return { ok: false, reason: blocked }
  const marchIndex = campaign.marches.findIndex((march) => march.id === marchId && march.actorId === actorRealmId)
  if (marchIndex < 0) return { ok: false, reason: 'Поход не найден или уже завершён' }
  const march = campaign.marches[marchIndex]
  const source = campaign.provinces.find((province) => province.id === march.sourceId)
  if (!source || source.owner !== actorRealmId) {
    return { ok: false, reason: 'Исходная провинция больше не принадлежит вашей державе' }
  }

  const casualties = Math.max(1, Math.ceil(march.soldiers * CAMPAIGN_MARCH_RECALL_LOSS))
  const returned = Math.max(0, march.soldiers - casualties)
  source.levies = Math.min(300, source.levies + returned)
  campaign.marches.splice(marchIndex, 1)
  return {
    ok: true,
    message: `${source.name}: поход отозван · вернулись ${returned}, потери ${casualties}`,
  }
}

function returnMarchArmy(campaign: CampaignState, march: CampaignMarch, soldiers: number): number {
  const source = campaign.provinces.find((province) => (
    province.id === march.sourceId && province.owner === march.actorId
  ))
  if (!source || soldiers < 1) return 0
  const returned = Math.min(soldiers, Math.max(0, 300 - source.levies))
  source.levies += returned
  return returned
}

function resolveSiegeMarch(
  campaign: CampaignState,
  march: CampaignMarch,
): CampaignMarchResolution | null {
  if (!march.siegeId) return null
  const source = campaign.provinces.find((province) => province.id === march.sourceId)
  const target = campaign.provinces.find((province) => province.id === march.targetId)
  const siege = campaign.sieges.find((item) => item.id === march.siegeId && item.targetId === march.targetId)
  const role = siege ? campaignSiegeMarchRole(campaign, siege, march.actorId) : null
  const cancelled = (reason: string): CampaignMarchResolution => {
    const returned = returnMarchArmy(campaign, march, march.soldiers)
    return {
      marchId: march.id,
      actorId: march.actorId,
      targetId: march.targetId,
      outcome: 'cancelled',
      message: `${reason}${returned > 0 ? ` · вернулись ${returned}` : ''}`,
      formation: march.formation,
      defenseFormation: target?.defenseFormation ?? march.formation,
      formationModifier: 0,
      capitalCaptured: false,
      defeatedRealmId: null,
      winnerRealmId: campaign.winnerRealmId,
    }
  }
  if (!target || !siege || !role) return cancelled('Поход к стенам возвращён: эта осада уже не действует')
  if (!source || source.owner !== march.actorId) {
    return cancelled('Поход к стенам распущен: исходная провинция потеряна')
  }

  const realm = campaign.realms.find((item) => item.id === march.actorId)
  if (role === 'reinforce') {
    const previousSoldiers = siege.soldiers
    siege.soldiers += march.soldiers
    siege.supplies = (siege.supplies ?? 0) + (march.supplies ?? 0)
    siege.engines = Math.min(2, (siege.engines ?? 0) + (march.engines ?? 0))
    const formationChanged = march.soldiers >= previousSoldiers
    if (formationChanged) siege.formation = march.formation
    return {
      marchId: march.id,
      actorId: march.actorId,
      targetId: target.id,
      outcome: 'siege-reinforced',
      message: [
        `${realm?.name ?? 'Войско'} усиливает лагерь у ${target.name} на ${march.soldiers}`,
        `в лагере ${siege.soldiers}`,
        `припасы ${siege.supplies}`,
        siege.engines > 0 ? `машины ${siege.engines}` : null,
        formationChanged ? `строй принят: ${FORMATION_SHAPE_LABELS[march.formation].toLowerCase()}` : null,
      ].filter(Boolean).join(' · '),
      formation: march.formation,
      defenseFormation: siege.formation,
      formationModifier: 0,
      capitalCaptured: false,
      defeatedRealmId: null,
      winnerRealmId: campaign.winnerRealmId,
    }
  }

  const formationModifier = formationMatchupModifier(march.formation, siege.formation)
  const reliefStrength = Math.round(march.soldiers * (1 + formationModifier))
  const siegeStrength = siege.soldiers
  if (reliefStrength > siegeStrength) {
    const reliefLosses = Math.min(
      Math.max(0, march.soldiers - 1),
      Math.max(1, Math.ceil(siege.soldiers * 0.6)),
    )
    const survivors = march.soldiers - reliefLosses
    const accepted = Math.min(survivors, Math.max(0, 300 - target.levies))
    target.levies += accepted
    const returned = returnMarchArmy(campaign, march, survivors - accepted)
    campaign.sieges = campaign.sieges.filter((item) => item.id !== siege.id)
    return {
      marchId: march.id,
      actorId: march.actorId,
      targetId: target.id,
      outcome: 'siege-relieved',
      message: [
        `${realm?.name ?? 'Войско'} разбивает лагерь у ${target.name}${formationResultSuffix(formationModifier)}`,
        `потери деблокаторов ${reliefLosses}`,
        `${accepted} вошли в гарнизон`,
        returned > 0 ? `${returned} вернулись` : null,
      ].filter(Boolean).join(' · '),
      formation: march.formation,
      defenseFormation: siege.formation,
      formationModifier,
      capitalCaptured: false,
      defeatedRealmId: null,
      winnerRealmId: campaign.winnerRealmId,
    }
  }

  const siegeLosses = Math.min(
    Math.max(0, siege.soldiers - 1),
    Math.max(1, Math.ceil(march.soldiers * 0.55)),
  )
  siege.soldiers -= siegeLosses
  siege.progress = Math.max(0, siege.progress - 10)
  return {
    marchId: march.id,
    actorId: march.actorId,
    targetId: target.id,
    outcome: 'relief-repelled',
    message: `${target.name}: деблокирующая армия разбита${formationResultSuffix(formationModifier)} · осаждающие потеряли ${siegeLosses}`,
    formation: march.formation,
    defenseFormation: siege.formation,
    formationModifier,
    capitalCaptured: false,
    defeatedRealmId: null,
    winnerRealmId: campaign.winnerRealmId,
  }
}

export function executeSiegeManeuver(
  campaign: CampaignState,
  sourceId: number,
  siegeId: string,
  commitmentPercent: CampaignCommitment,
  actorRealmId: RealmId = campaign.playerRealmId,
  formation: FormationShape = 'line',
): CampaignMarchResolution | CampaignAttackFailure {
  const marker = Math.max(0, campaign.tick)
  const result = beginSiegeMarch(campaign, {
    id: `local-siege-march:${siegeId}:${sourceId}:${marker}`,
    siegeId,
    actorId: actorRealmId,
    sourceId,
    commitmentPercent,
    formation,
    departedAt: marker,
    arrivesAt: marker + 1,
  })
  if (!result.ok) return result
  campaign.marches = campaign.marches.filter((march) => march.id !== result.march.id)
  return resolveSiegeMarch(campaign, result.march)
    ?? { ok: false, reason: 'Осадный манёвр не удалось разрешить' }
}

interface CampaignMarchInterception {
  left: CampaignMarch
  right: CampaignMarch
  provinceId: number
  happensAt: number
}

function marchNodeArrival(march: CampaignMarch, nodeIndex: number): number {
  const legs = Math.max(1, march.route.length - 1)
  const legDuration = (march.arrivesAt - march.departedAt) / legs
  return march.departedAt + legDuration * nodeIndex
}

function marchInterception(
  campaign: CampaignState,
  left: CampaignMarch,
  right: CampaignMarch,
): CampaignMarchInterception | null {
  if (
    left.actorId === right.actorId
    || left.siegeId
    || right.siegeId
    || campaignRelation(campaign, right.actorId, left.actorId)?.status !== 'war'
  ) return null

  const candidates: CampaignMarchInterception[] = []
  for (let leftIndex = 1; leftIndex < left.route.length; leftIndex += 1) {
    const provinceId = left.route[leftIndex]
    const rightIndex = right.route.indexOf(provinceId, 1)
    if (rightIndex < 1) continue
    const leftAtTarget = leftIndex === left.route.length - 1
    const rightAtTarget = rightIndex === right.route.length - 1
    if (!leftAtTarget && !rightAtTarget) continue
    const leftArrival = marchNodeArrival(left, leftIndex)
    const rightArrival = marchNodeArrival(right, rightIndex)
    const leftLeg = (left.arrivesAt - left.departedAt) / Math.max(1, left.route.length - 1)
    const rightLeg = (right.arrivesAt - right.departedAt) / Math.max(1, right.route.length - 1)
    if (Math.abs(leftArrival - rightArrival) > Math.min(leftLeg, rightLeg) / 2) continue
    candidates.push({
      left,
      right,
      provinceId,
      happensAt: Math.max(leftArrival, rightArrival),
    })
  }
  return candidates.sort((a, b) => a.happensAt - b.happensAt || a.provinceId - b.provinceId)[0] ?? null
}

function resolveCampaignInterceptions(campaign: CampaignState, now: number): CampaignMarchResolution[] {
  const candidates: CampaignMarchInterception[] = []
  for (let leftIndex = 0; leftIndex < campaign.marches.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < campaign.marches.length; rightIndex += 1) {
      const candidate = marchInterception(campaign, campaign.marches[leftIndex], campaign.marches[rightIndex])
      if (candidate && candidate.happensAt <= now) candidates.push(candidate)
    }
  }
  candidates.sort((left, right) => (
    left.happensAt - right.happensAt
    || left.left.actorId.localeCompare(right.left.actorId)
    || left.left.sourceId - right.left.sourceId
    || left.left.id.localeCompare(right.left.id)
    || left.right.id.localeCompare(right.right.id)
  ))

  const resolvedIds = new Set<string>()
  const reports: CampaignMarchResolution[] = []
  for (const candidate of candidates) {
    if (resolvedIds.has(candidate.left.id) || resolvedIds.has(candidate.right.id)) continue
    const leftModifier = formationMatchupModifier(candidate.left.formation, candidate.right.formation)
    const rightModifier = formationMatchupModifier(candidate.right.formation, candidate.left.formation)
    const leftStrength = candidate.left.soldiers * (1 + leftModifier)
    const rightStrength = candidate.right.soldiers * (1 + rightModifier)
    let leftLosses: number
    let rightLosses: number
    if (leftStrength > rightStrength) {
      leftLosses = Math.min(candidate.left.soldiers, Math.max(1, Math.ceil(candidate.right.soldiers * 0.6)))
      rightLosses = candidate.right.soldiers
    } else if (rightStrength > leftStrength) {
      leftLosses = candidate.left.soldiers
      rightLosses = Math.min(candidate.right.soldiers, Math.max(1, Math.ceil(candidate.left.soldiers * 0.6)))
    } else {
      leftLosses = Math.min(candidate.left.soldiers, Math.max(1, Math.ceil(candidate.right.soldiers * 0.65)))
      rightLosses = Math.min(candidate.right.soldiers, Math.max(1, Math.ceil(candidate.left.soldiers * 0.65)))
    }
    const leftReturned = returnMarchArmy(campaign, candidate.left, candidate.left.soldiers - leftLosses)
    const rightReturned = returnMarchArmy(campaign, candidate.right, candidate.right.soldiers - rightLosses)
    const province = campaign.provinces.find((item) => item.id === candidate.provinceId)
    const leftRealm = campaign.realms.find((realm) => realm.id === candidate.left.actorId)
    const rightRealm = campaign.realms.find((realm) => realm.id === candidate.right.actorId)
    resolvedIds.add(candidate.left.id)
    resolvedIds.add(candidate.right.id)
    reports.push(
      {
        marchId: candidate.left.id,
        actorId: candidate.left.actorId,
        targetId: candidate.provinceId,
        outcome: 'intercepted',
        message: `${leftRealm?.shortName ?? 'Колонна'} встречена у ${province?.name ?? 'рубежа'} · потери ${leftLosses}, вернулись ${leftReturned}`,
        formation: candidate.left.formation,
        defenseFormation: candidate.right.formation,
        formationModifier: leftModifier,
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: campaign.winnerRealmId,
      },
      {
        marchId: candidate.right.id,
        actorId: candidate.right.actorId,
        targetId: candidate.provinceId,
        outcome: 'intercepted',
        message: `${rightRealm?.shortName ?? 'Колонна'} встречена у ${province?.name ?? 'рубежа'} · потери ${rightLosses}, вернулись ${rightReturned}`,
        formation: candidate.right.formation,
        defenseFormation: candidate.left.formation,
        formationModifier: rightModifier,
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: campaign.winnerRealmId,
      },
    )
  }
  if (resolvedIds.size > 0) {
    campaign.marches = campaign.marches.filter((march) => !resolvedIds.has(march.id))
  }
  return reports
}

export function resolveCampaignMarches(campaign: CampaignState, now: number): CampaignMarchResolution[] {
  const interceptionReports = resolveCampaignInterceptions(campaign, now)
  const siegeArrivalPriority = (march: CampaignMarch): number => {
    if (!march.siegeId) return 2
    const siege = campaign.sieges.find((item) => item.id === march.siegeId)
    const role = siege ? campaignSiegeMarchRole(campaign, siege, march.actorId) : null
    return role === 'reinforce' ? 0 : role === 'relief' ? 1 : 2
  }
  const due = campaign.marches
    .filter((march) => march.arrivesAt <= now)
    .sort((left, right) => (
      left.arrivesAt - right.arrivesAt
      || left.departedAt - right.departedAt
      || siegeArrivalPriority(left) - siegeArrivalPriority(right)
      || left.actorId.localeCompare(right.actorId)
      || left.sourceId - right.sourceId
      || left.targetId - right.targetId
      || left.id.localeCompare(right.id)
    ))
  if (due.length === 0) return interceptionReports
  const dueIds = new Set(due.map((march) => march.id))
  campaign.marches = campaign.marches.filter((march) => !dueIds.has(march.id))

  return [...interceptionReports, ...due.map((march) => {
    if (campaign.winnerRealmId) {
      return {
        marchId: march.id,
        actorId: march.actorId,
        targetId: march.targetId,
        outcome: 'cancelled' as const,
        message: 'Поход остановлен: матч уже завершён',
        formation: march.formation,
        defenseFormation: march.formation,
        formationModifier: 0,
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: null,
      }
    }
    if (campaign.realms.find((realm) => realm.id === march.actorId)?.status === 'defeated') {
      return {
        marchId: march.id,
        actorId: march.actorId,
        targetId: march.targetId,
        outcome: 'cancelled' as const,
        message: 'Поход распущен: держава больше не владеет землями',
        formation: march.formation,
        defenseFormation: march.formation,
        formationModifier: 0,
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: null,
      }
    }
    const source = campaign.provinces.find((province) => province.id === march.sourceId)
    const target = campaign.provinces.find((province) => province.id === march.targetId)
    const realm = campaign.realms.find((item) => item.id === march.actorId)
    const siegeResolution = resolveSiegeMarch(campaign, march)
    if (siegeResolution) return siegeResolution
    if (!target) {
      if (source?.owner === march.actorId) source.levies += march.soldiers
      return {
        marchId: march.id,
        actorId: march.actorId,
        targetId: march.targetId,
        outcome: 'cancelled' as const,
        message: 'Поход отменён: цель больше не существует',
        formation: march.formation,
        defenseFormation: march.formation,
        formationModifier: 0,
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: campaign.winnerRealmId,
      }
    }
    const targetRelation = target.owner
      ? campaignRelation(campaign, target.owner, march.actorId)
      : null
    if (
      target.owner === march.actorId
      || (march.kind === 'support' && targetRelation?.status === 'alliance')
    ) {
      const accepted = Math.min(march.soldiers, 300 - target.levies)
      const returned = march.soldiers - accepted
      target.levies += accepted
      if (returned > 0 && source?.owner === march.actorId) source.levies += returned
      return {
        marchId: march.id,
        actorId: march.actorId,
        targetId: target.id,
        outcome: 'reinforced' as const,
        message: march.kind === 'support'
          ? `${realm?.name ?? 'Союзное войско'} присылает ${accepted} ратников в ${target.name}`
          : `${realm?.name ?? 'Войско'} усиливает ${target.name}`,
        formation: march.formation,
        defenseFormation: target.defenseFormation,
        formationModifier: 0,
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: campaign.winnerRealmId,
      }
    }
    if (march.kind === 'support' || (target.owner && targetRelation?.status !== 'war')) {
      if (source?.owner === march.actorId) source.levies += march.soldiers
      return {
        marchId: march.id,
        actorId: march.actorId,
        targetId: target.id,
        outcome: 'cancelled' as const,
        message: march.kind === 'support'
          ? `Подкрепление в ${target.name} возвращено: союз больше не действует`
          : `Поход на ${target.name} остановлен мирным договором`,
        formation: march.formation,
        defenseFormation: target.defenseFormation,
        formationModifier: 0,
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: campaign.winnerRealmId,
      }
    }
    if (campaignSiegeAt(campaign, target.id)) {
      if (source?.owner === march.actorId) source.levies += march.soldiers
      return {
        marchId: march.id,
        actorId: march.actorId,
        targetId: target.id,
        outcome: 'cancelled' as const,
        message: `Поход на ${target.name} возвращён: у стен уже стоит другая осада`,
        formation: march.formation,
        defenseFormation: target.defenseFormation,
        formationModifier: 0,
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: campaign.winnerRealmId,
      }
    }
    const siege = beginCommittedSiege(
      campaign,
      march.sourceId,
      target,
      march.soldiers,
      march.actorId,
      march.formation,
      `siege:${march.id}`,
      march.supplies ?? 0,
      march.engines ?? 0,
    )
    if (siege) {
      return {
        marchId: march.id,
        actorId: march.actorId,
        targetId: target.id,
        outcome: 'besieged' as const,
        message: `${realm?.name ?? 'Войско'} окружает ${target.name} · начата блокада`,
        formation: march.formation,
        defenseFormation: target.defenseFormation,
        formationModifier: formationMatchupModifier(march.formation, target.defenseFormation),
        capitalCaptured: false,
        defeatedRealmId: null,
        winnerRealmId: campaign.winnerRealmId,
      }
    }
    const result = resolveCommittedAttack(campaign, target, march.soldiers, march.actorId, march.formation)
    return {
      marchId: march.id,
      actorId: march.actorId,
      targetId: target.id,
      outcome: result.outcome,
      formation: result.formation,
      defenseFormation: result.defenseFormation,
      formationModifier: result.formationModifier,
      capitalCaptured: result.capitalCaptured,
      previousOwner: result.previousOwner,
      defeatedRealmId: result.defeatedRealmId,
      winnerRealmId: result.winnerRealmId,
      message: result.outcome === 'captured'
        ? [
            `${realm?.name ?? 'Войско'} захватывает ${target.name}${formationResultSuffix(result.formationModifier)}`,
            result.capitalCaptured ? 'столица пала' : null,
            result.defeatedRealmId ? 'держава разгромлена' : null,
            result.winnerRealmId ? 'матч завершён' : null,
          ].filter(Boolean).join(' · ')
        : `Поход державы ${realm?.shortName ?? march.actorId} на ${target.name} отбит${formationResultSuffix(result.formationModifier)}`,
    }
  })]
}

function formationResultSuffix(modifier: number): string {
  return modifier === 0 ? '' : ` · строй ${modifier > 0 ? '+' : '−'}${Math.abs(Math.round(modifier * 100))}%`
}

export function resolveCampaignSieges(campaign: CampaignState): CampaignTurnReport[] {
  const reports: CampaignTurnReport[] = []
  const due = [...campaign.sieges]
    .filter((siege) => siege.lastResolvedAt < campaign.tick)
    .sort((left, right) => left.startedAt - right.startedAt || left.id.localeCompare(right.id))

  for (const pending of due) {
    const siege = campaign.sieges.find((item) => item.id === pending.id)
    if (!siege || campaign.winnerRealmId) continue
    const target = campaign.provinces.find((province) => province.id === siege.targetId)
    const relation = campaignRelation(campaign, siege.defenderId, siege.attackerId)
    if (
      !target
      || target.owner !== siege.defenderId
      || relation?.status !== 'war'
      || campaign.realms.find((realm) => realm.id === siege.attackerId)?.status !== 'active'
    ) {
      const returned = returnSiegeArmy(campaign, siege, siege.soldiers)
      campaign.sieges = campaign.sieges.filter((item) => item.id !== siege.id)
      reports.push({
        kind: 'siege-lifted',
        actorId: siege.attackerId,
        targetOwner: siege.defenderId,
        provinceId: siege.targetId,
        message: `Осада снята${returned > 0 ? ` · вернулись ${returned} ратников` : ''}`,
      })
      continue
    }

    if (siege.soldiers < 4) {
      const returned = returnSiegeArmy(campaign, siege, siege.soldiers)
      campaign.sieges = campaign.sieges.filter((item) => item.id !== siege.id)
      reports.push({
        kind: 'siege-lifted',
        actorId: siege.attackerId,
        targetOwner: siege.defenderId,
        provinceId: target.id,
        message: `${target.name}: осадный лагерь слишком мал${returned > 0 ? ` · вернулись ${returned}` : ''}`,
      })
      continue
    }

    const supplyCost = campaignSiegeDailySupplyCost(siege)
    const supplies = siege.supplies ?? 0
    const starving = supplies < supplyCost
    siege.supplies = Math.max(0, supplies - supplyCost)

    if (siege.tactic === 'assault') {
      const formationModifier = formationMatchupModifier(siege.formation, target.defenseFormation)
      const breachBonus = siege.progress / 200
      const engineBonus = (siege.engines ?? 0) * 0.15
      const starvationPenalty = starving ? 0.2 : 0
      const remainingWalls = target.fortificationLevel * 0.25 * (1 - siege.progress / 100)
      const attackStrength = Math.round(
        siege.soldiers * (1 + formationModifier + breachBonus + engineBonus - starvationPenalty),
      )
      const defenseStrength = Math.round(target.levies * (1 + remainingWalls))
      campaign.sieges = campaign.sieges.filter((item) => item.id !== siege.id)
      if (attackStrength > defenseStrength) {
        const previousOwner = target.owner
        const attackerLosses = Math.min(siege.soldiers - 3, Math.max(1, Math.ceil(target.levies * 0.7)))
        const defenderLosses = target.levies
        target.owner = siege.attackerId
        target.levies = Math.max(3, siege.soldiers - attackerLosses)
        target.defenseFormation = siege.formation
        target.fortificationLevel = Math.max(0, target.fortificationLevel - 1) as ProvinceLevel
        const conquest = registerConquest(campaign, target, previousOwner, siege.attackerId)
        reports.push({
          kind: 'siege-resolved',
          actorId: siege.attackerId,
          targetOwner: previousOwner,
          provinceId: target.id,
          message: [
            `${target.name}: штурм победил · потери ${attackerLosses}/${defenderLosses}`,
            (siege.engines ?? 0) > 0 ? `осадные машины +${(siege.engines ?? 0) * 15}%` : null,
            starving ? 'лагерь голодал' : null,
            conquest.capitalCaptured ? 'столица пала' : null,
            conquest.defeatedRealmId ? 'держава разгромлена' : null,
            conquest.winnerRealmId ? 'матч завершён' : null,
          ].filter(Boolean).join(' · '),
        })
      } else {
        const defenderLosses = Math.min(target.levies - 1, Math.max(1, Math.round(siege.soldiers * 0.55)))
        target.levies -= defenderLosses
        reports.push({
          kind: 'siege-resolved',
          actorId: siege.attackerId,
          targetOwner: siege.defenderId,
          provinceId: target.id,
          message: [
            `${target.name}: штурм отбит · осаждающие потеряны, гарнизон потерял ${defenderLosses}`,
            (siege.engines ?? 0) > 0 ? `осадные машины +${(siege.engines ?? 0) * 15}%` : null,
            starving ? 'лагерь голодал' : null,
          ].filter(Boolean).join(' · '),
        })
      }
      continue
    }

    let tactic = siege.tactic
    let paymentFailed = false
    if (tactic === 'sappers') {
      const economy = realmEconomy(campaign, siege.attackerId)
      if (!economy || economy.silver < CAMPAIGN_SAPPER_DAILY_COST) {
        tactic = 'blockade'
        siege.tactic = 'blockade'
        paymentFailed = true
      } else {
        economy.silver -= CAMPAIGN_SAPPER_DAILY_COST
      }
    }
    const fullProgressGain = campaignSiegeDailyProgress(campaign, siege, tactic)
    const progressGain = starving ? Math.max(1, Math.floor(fullProgressGain / 2)) : fullProgressGain
    const attackerRate = (tactic === 'sappers' ? 0.03 : 0.01) + (starving ? 0.08 : 0)
    const defenderRate = tactic === 'sappers' ? 0.05 : 0.08
    const attackerLosses = Math.min(
      siege.soldiers,
      Math.max(1, Math.ceil(siege.soldiers * attackerRate * (1 + target.fortificationLevel * 0.2))),
    )
    const defenderLosses = Math.min(
      Math.max(0, target.levies - 1),
      Math.max(1, Math.ceil(target.levies * defenderRate)),
    )
    siege.soldiers -= attackerLosses
    target.levies -= defenderLosses
    siege.progress = Math.min(100, siege.progress + progressGain)
    siege.lastResolvedAt = campaign.tick

    if (siege.soldiers < 4) {
      const returned = returnSiegeArmy(campaign, siege, siege.soldiers)
      campaign.sieges = campaign.sieges.filter((item) => item.id !== siege.id)
      reports.push({
        kind: 'siege-lifted',
        actorId: siege.attackerId,
        targetOwner: siege.defenderId,
        provinceId: target.id,
        message: `${target.name}: осадный лагерь истощён${returned > 0 ? ` · вернулись ${returned}` : ''}`,
      })
      continue
    }

    if (siege.progress >= 100 || target.levies <= 1) {
      const previousOwner = target.owner
      target.owner = siege.attackerId
      target.levies = Math.max(3, siege.soldiers)
      target.defenseFormation = siege.formation
      target.fortificationLevel = Math.max(0, target.fortificationLevel - 1) as ProvinceLevel
      campaign.sieges = campaign.sieges.filter((item) => item.id !== siege.id)
      const conquest = registerConquest(campaign, target, previousOwner, siege.attackerId)
      reports.push({
        kind: 'siege-resolved',
        actorId: siege.attackerId,
        targetOwner: previousOwner,
        provinceId: target.id,
        message: [
          `${target.name}: гарнизон капитулировал после пролома`,
          conquest.capitalCaptured ? 'столица пала' : null,
          conquest.defeatedRealmId ? 'держава разгромлена' : null,
          conquest.winnerRealmId ? 'матч завершён' : null,
        ].filter(Boolean).join(' · '),
      })
      continue
    }

    reports.push({
      kind: 'siege-advanced',
      actorId: siege.attackerId,
      targetOwner: siege.defenderId,
      provinceId: target.id,
      message: [
        paymentFailed ? 'Казна пуста: подкоп остановлен' : null,
        `${target.name}: осада ${siege.progress}%`,
        `припасы ${siege.supplies}`,
        starving ? 'голод: работы замедлены' : null,
        `потери ${attackerLosses}/${defenderLosses}`,
      ].filter(Boolean).join(' · '),
    })
  }
  return reports
}

function aiExpansion(
  campaign: CampaignState,
  actorId: RealmId,
  timing: CampaignMarchTiming,
): CampaignTurnReport | null {
  const realm = campaign.realms.find((item) => item.id === actorId)
  if (!realm || realm.status === 'defeated' || campaign.winnerRealmId) return null
  const sources = campaign.provinces.filter((source) => (
    source.owner === actorId
    && source.levies >= 12
    && !campaignSiegeAt(campaign, source.id)
    && !campaign.marches.some((march) => march.actorId === actorId && march.sourceId === source.id)
  ))
  const targets = campaign.provinces
    .filter((target) => !campaignSiegeAt(campaign, target.id))
    .filter((target) => target.owner === null
      || (target.owner !== actorId && campaignRelation(campaign, target.owner, actorId)?.status === 'war'))
  const candidates = sources.flatMap((source) => targets.flatMap((target) => {
    const route = campaignMarchRoute(campaign, source.id, target.id, actorId)
    return route ? [{ source, target, route }] : []
  }))
  candidates.sort((left, right) => {
    const leftPriority = left.target.owner !== null ? 0 : 1
    const rightPriority = right.target.owner !== null ? 0 : 1
    return leftPriority - rightPriority
      || left.target.levies - right.target.levies
      || left.route.length - right.route.length
      || left.target.id - right.target.id
      || left.source.id - right.source.id
  })
  const choice = candidates.find(({ source, target }) => {
    const committed = Math.floor(source.levies * 0.75)
    const attackStrength = Math.round(committed * (1 + Math.max(0, realm.ruler.martial - 8) * 0.03))
    const defenseStrength = Math.round(target.levies * (1 + target.fortificationLevel * 0.25))
    return source.levies - committed >= 4 && attackStrength > defenseStrength
  })
  if (!choice) return null

  const previousOwner = choice.target.owner
  const order = beginCampaignMarch(
    campaign,
    {
      id: `ai:${actorId}:${campaign.tick}:${choice.source.id}:${choice.target.id}`,
      actorId,
      sourceId: choice.source.id,
      targetId: choice.target.id,
      commitmentPercent: 75,
      formation: choice.source.defenseFormation,
      departedAt: timing.departedAt,
      arrivesAt: timing.departedAt + timing.legDurationMs,
    },
  )
  if (!order.ok) return null
  return {
    kind: 'march-started',
    actorId,
    targetOwner: previousOwner,
    provinceId: choice.target.id,
    message: `${realm.name}: ${order.march.soldiers} ратников выступили на ${choice.target.name} · ${order.march.route.length - 1} перехода`,
  }
}

export function advanceCampaign(
  campaign: CampaignState,
  days = 1,
  options: AdvanceCampaignOptions = {},
): CampaignTurnReport[] {
  if (campaign.winnerRealmId) return []
  const reports: CampaignTurnReport[] = []
  const logicalMarchClock = options.marchTiming === undefined
  for (let day = 0; day < days; day += 1) {
    campaign.tick += 1
    if (logicalMarchClock) {
      for (const resolution of resolveCampaignMarches(campaign, campaign.tick)) {
        reports.push({
          kind: resolution.outcome === 'captured'
            ? 'conquest'
            : resolution.outcome === 'besieged'
              ? 'siege-advanced'
              : 'march-resolved',
          actorId: resolution.actorId,
          targetOwner: resolution.previousOwner ?? null,
          provinceId: resolution.targetId,
          message: resolution.message,
        })
      }
      if (campaign.winnerRealmId) break
    }
    for (const province of campaign.provinces) {
      if (!province.project || province.project.completesAt > campaign.tick) continue
      const project = province.project
      province.project = null
      if (!province.owner) continue
      if (project.kind === 'settlement') province.cityLevel = (province.cityLevel + 1) as ProvinceLevel
      if (project.kind === 'market') province.marketLevel = (province.marketLevel + 1) as ProvinceLevel
      if (project.kind === 'fortification') province.fortificationLevel = (province.fortificationLevel + 1) as ProvinceLevel
      if (project.kind === 'workshop') province.workshopLevel = (province.workshopLevel + 1) as ProvinceLevel
      reports.push({
        kind: 'project-completed',
        actorId: province.owner,
        targetOwner: province.owner,
        provinceId: province.id,
        message: `${province.name}: проект «${PROVINCE_PROJECTS[project.kind].label.toLowerCase()}» завершён`,
      })
    }
    for (const economy of campaign.economies) {
      economy.silver = Math.min(9999, economy.silver + realmDailyIncome(campaign, economy.realmId))
    }
    reports.push(...resolveCampaignSieges(campaign))
    if (campaign.winnerRealmId) break
    for (const relation of campaign.relations) {
      if (relation.status !== 'truce' || relation.truceUntil === null || campaign.tick < relation.truceUntil) continue
      relation.status = 'neutral'
      relation.truceUntil = null
      const otherRealmId = relation.realmIds.find((realmId) => realmId !== campaign.playerRealmId) ?? relation.realmIds[1]
      const realm = campaign.realms.find((item) => item.id === otherRealmId)
      reports.push({
        kind: 'truce-ended',
        actorId: otherRealmId,
        targetOwner: campaign.playerRealmId,
        provinceId: null,
        message: `Перемирие с ${realm?.name ?? 'соседней державой'} истекло`,
      })
    }
    if (campaign.tick % 3 === 0) {
      for (const province of campaign.provinces) {
        if (!province.owner) continue
        if (campaignSiegeAt(campaign, province.id)) continue
        const ruler = campaign.realms.find((realm) => realm.id === province.owner)?.ruler
        const stewardshipBonus = ruler && ruler.stewardship >= 12 ? 1 : 0
        province.levies = Math.min(provinceLevyCap(province), province.levies + 1 + province.cityLevel + stewardshipBonus)
      }
    }
    if (campaign.tick % 4 === 0 && options.aiExpansion !== false) {
      const configuredAiRealms = options.aiRealmIds
        ?? campaign.realms
          .filter((realm) => realm.id !== campaign.playerRealmId)
          .map((realm) => realm.id)
      const timing = options.marchTiming ?? {
        departedAt: campaign.tick,
        legDurationMs: 1,
      }
      for (const realmId of configuredAiRealms.filter((realmId) => (
        campaign.realms.some((realm) => realm.id === realmId && realm.status === 'active')
      ))) {
        const report = aiExpansion(campaign, realmId, timing)
        if (report) reports.push(report)
      }
    }
    if (campaign.tick % 360 === 0) {
      for (const realm of campaign.realms) realm.ruler.age += 1
    }
  }
  return reports
}

export function realmProvinceCount(campaign: CampaignState, realmId: RealmId): number {
  return campaign.provinces.filter((province) => province.owner === realmId).length
}

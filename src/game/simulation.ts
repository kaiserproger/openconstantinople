import {
  advanceCampaign,
  createCampaign,
  type CampaignMarchTiming,
  type CampaignState,
  type CampaignTurnReport,
} from './campaign'

export type BuildingKind =
  | 'road'
  | 'house'
  | 'farm'
  | 'lumberCamp'
  | 'quarry'
  | 'granary'
  | 'market'
  | 'smithy'
  | 'barracks'
  | 'watchtower'
  | 'wall'
  | 'townHall'

export interface Point { x: number; y: number }

export interface ValleyMap {
  seed: string
  river: Point[]
  forests: Point[]
  fertileFields: Point[]
  stoneDeposits: Point[]
}

export interface Building extends Point {
  id: number
  kind: BuildingKind
  progress: number
  health: number
}

export type ThreatStatus = 'forming' | 'approaching' | 'raiding' | 'withdrawing' | 'disbanded'
export type IntelConfidence = 'rumor' | 'approximate' | 'confirmed'

export interface Threat {
  id: number
  kind: 'scouts' | 'raiders' | 'invasion'
  strength: number
  supplies: number
  status: ThreatStatus
  intel: IntelConfidence
  formedDay: number
}

export interface Crisis {
  id: number
  kind: 'famine' | 'rebellion' | 'coup'
  pressure: number
}

export type CrisisResponse = 'fund' | 'hardline'

const CRISIS_FUND_COST: Record<Crisis['kind'], number> = {
  famine: 24,
  rebellion: 18,
  coup: 28,
}

export interface SettlementOutlook {
  dailyFood: number
  reserveDays: number | null
  level: 'secure' | 'strained' | 'critical'
}

export interface GameEvent {
  id: number
  day: number
  title: string
  text: string
  tone: 'neutral' | 'good' | 'warning' | 'danger'
}

export interface GameState {
  tick: number
  day: number
  year: number
  season: 'Весна' | 'Лето' | 'Осень' | 'Зима'
  people: number
  capacity: number
  order: number
  legitimacy: number
  resources: { food: number; wood: number; stone: number; silver: number }
  map: ValleyMap
  campaign: CampaignState
  buildings: Building[]
  threats: Threat[]
  crises: Crisis[]
  events: GameEvent[]
  nextId: number
}

const BUILD_COSTS: Record<BuildingKind, { wood: number; stone: number; silver: number }> = {
  road: { wood: 1, stone: 1, silver: 0 },
  house: { wood: 8, stone: 0, silver: 0 },
  farm: { wood: 12, stone: 2, silver: 0 },
  lumberCamp: { wood: 15, stone: 0, silver: 0 },
  quarry: { wood: 12, stone: 0, silver: 4 },
  granary: { wood: 18, stone: 6, silver: 0 },
  market: { wood: 20, stone: 8, silver: 10 },
  smithy: { wood: 16, stone: 14, silver: 8 },
  barracks: { wood: 24, stone: 14, silver: 10 },
  watchtower: { wood: 20, stone: 18, silver: 4 },
  wall: { wood: 4, stone: 10, silver: 0 },
  townHall: { wood: 36, stone: 30, silver: 20 },
}

export const BUILDING_FOOTPRINTS: Record<BuildingKind, readonly [number, number]> = {
  road: [1, 1],
  house: [5, 4],
  farm: [7, 6],
  lumberCamp: [6, 5],
  quarry: [6, 5],
  granary: [6, 4],
  market: [7, 6],
  smithy: [5, 4],
  barracks: [8, 6],
  watchtower: [4, 4],
  wall: [1, 1],
  townHall: [10, 8],
}

function footprintsOverlap(
  left: Pick<Building, 'kind' | 'x' | 'y'>,
  right: Pick<Building, 'kind' | 'x' | 'y'>,
  clearance = 0,
): boolean {
  const [leftWidth, leftDepth] = BUILDING_FOOTPRINTS[left.kind]
  const [rightWidth, rightDepth] = BUILDING_FOOTPRINTS[right.kind]
  return Math.abs(left.x - right.x) < (leftWidth + rightWidth) / 2 + clearance
    && Math.abs(left.y - right.y) < (leftDepth + rightDepth) / 2 + clearance
}

function isInsideMap(kind: BuildingKind, point: Point): boolean {
  const [width, depth] = BUILDING_FOOTPRINTS[kind]
  return point.x - width / 2 >= 0
    && point.x + width / 2 <= 64
    && point.y - depth / 2 >= 0
    && point.y + depth / 2 <= 64
}

function hasPlacementCollision(buildings: Building[], kind: BuildingKind, point: Point): boolean {
  const candidate = { kind, ...point }
  return buildings.some((building) => {
    const wall = kind === 'wall' ? candidate : building.kind === 'wall' ? building : null
    const tower = kind === 'watchtower' ? candidate : building.kind === 'watchtower' ? building : null
    if (wall && tower) {
      const [towerWidth, towerDepth] = BUILDING_FOOTPRINTS.watchtower
      const deltaX = Math.abs(wall.x - tower.x)
      const deltaY = Math.abs(wall.y - tower.y)
      const onVerticalFace = deltaX === towerWidth / 2 && deltaY <= towerDepth / 2
      const onHorizontalFace = deltaY === towerDepth / 2 && deltaX <= towerWidth / 2
      if (onVerticalFace || onHorizontalFace) return false
    }
    const linear = kind === 'road' || kind === 'wall' || building.kind === 'road' || building.kind === 'wall'
    return footprintsOverlap(candidate, building, linear ? 0 : 1)
  })
}

export function canPlaceAt(buildings: Building[], kind: BuildingKind, point: Point): boolean {
  return isInsideMap(kind, point) && !hasPlacementCollision(buildings, kind, point)
}

function hashSeed(seed: string): () => number {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function uniquePoints(random: () => number, count: number, inset = 4): Point[] {
  const points = new Map<string, Point>()
  while (points.size < count) {
    const point = {
      x: inset + Math.floor(random() * (64 - inset * 2)),
      y: inset + Math.floor(random() * (64 - inset * 2)),
    }
    points.set(`${point.x}:${point.y}`, point)
  }
  return [...points.values()]
}

function createMap(seed: string): ValleyMap {
  const random = hashSeed(seed)
  const river = Array.from({ length: 64 }, (_, y) => ({
    x: 28 + Math.round(Math.sin(y / 7) * 5 + random() * 2),
    y,
  }))
  return {
    seed,
    river,
    forests: uniquePoints(random, 48),
    fertileFields: uniquePoints(random, 24, 8),
    stoneDeposits: uniquePoints(random, 10, 7),
  }
}

export function createGame(seed: string): GameState {
  const landmarks: Array<[BuildingKind, number, number]> = [
    ['townHall', 32, 31], ['granary', 44, 18], ['market', 18, 31], ['smithy', 45, 29],
    ['house', 16, 18], ['house', 24, 18], ['house', 32, 18], ['house', 16, 41],
    ['house', 24, 41], ['house', 33, 43], ['house', 43, 42], ['house', 50, 39],
    ['farm', 14, 49], ['farm', 49, 49], ['lumberCamp', 13, 24], ['quarry', 52, 23],
    ['barracks', 29, 50], ['watchtower', 9, 9], ['watchtower', 55, 9],
    ['watchtower', 9, 55], ['watchtower', 55, 55],
  ]
  const walls: Array<[BuildingKind, number, number]> = []
  for (let x = 11; x <= 53; x += 1) {
    if (x < 38 || x > 40) walls.push(['wall', x, 7], ['wall', x, 57])
  }
  for (let y = 11; y <= 53; y += 1) {
    if (y < 35 || y > 37) walls.push(['wall', 7, y], ['wall', 57, y])
  }
  const roads: Array<[BuildingKind, number, number]> = []
  for (let x = 7; x <= 57; x += 1) roads.push(['road', x, 36])
  for (let y = 7; y <= 25; y += 1) roads.push(['road', 39, y])
  for (let y = 37; y <= 57; y += 1) roads.push(['road', 39, y])

  const urbanNucleus: Building[] = [...landmarks, ...walls, ...roads].map(([kind, x, y], index) => ({
    id: index + 1,
    kind: kind as BuildingKind,
    x: x as number,
    y: y as number,
    progress: 1,
    health: kind === 'watchtower' ? 72 : 100,
  }))
  const chronicleId = urbanNucleus.length + 1
  return {
    tick: 0,
    day: 1,
    year: 4,
    season: 'Осень',
    people: 98,
    capacity: 120,
    order: 72,
    legitimacy: 66,
    resources: { food: 2845, wood: 120, stone: 96, silver: 92 },
    map: createMap(seed),
    campaign: createCampaign(seed),
    buildings: urbanNucleus,
    threats: [],
    crises: [],
    events: [
      { id: chronicleId, day: 1, title: 'Новая летопись', text: 'Порфирополис встречает осень.', tone: 'neutral' },
    ],
    nextId: chronicleId + 1,
  }
}

export function placeBuilding(state: GameState, kind: BuildingKind, point: Point): { ok: true } | { ok: false; reason: string } {
  if (state.buildings.some((building) => building.x === point.x && building.y === point.y)) {
    return { ok: false, reason: 'Здесь уже стоит постройка' }
  }
  if (!isInsideMap(kind, point)) return { ok: false, reason: 'Постройка выходит за границы карты' }
  if (!canPlaceAt(state.buildings, kind, point)) return { ok: false, reason: 'Постройкам не хватает места' }
  const cost = BUILD_COSTS[kind]
  if (state.resources.wood < cost.wood || state.resources.stone < cost.stone || state.resources.silver < cost.silver) {
    return { ok: false, reason: 'Не хватает припасов' }
  }
  state.resources.wood -= cost.wood
  state.resources.stone -= cost.stone
  state.resources.silver -= cost.silver
  state.buildings.push({ id: state.nextId++, kind, ...point, progress: kind === 'road' ? 1 : 0.15, health: 100 })
  state.events.push({ id: state.nextId++, day: state.day, title: 'Начато строительство', text: `Заложена новая постройка: ${kind}.`, tone: 'good' })
  return { ok: true }
}

export function placePath(
  state: GameState,
  kind: 'road' | 'wall',
  points: Point[],
): { ok: true; placed: number } | { ok: false; reason: string } {
  const unique = [...new Map(points.map((point) => [`${point.x}:${point.y}`, point])).values()]
  if (!unique.length) return { ok: false, reason: 'Путь не задан' }
  if (unique.some((point) => point.x < 0 || point.x > 63 || point.y < 0 || point.y > 63)) {
    return { ok: false, reason: 'Путь выходит за границы карты' }
  }
  if (unique.some((point) => hasPlacementCollision(state.buildings, kind, point))) {
    return { ok: false, reason: 'Здесь уже стоит постройка' }
  }
  const cost = BUILD_COSTS[kind]
  const total = {
    wood: cost.wood * unique.length,
    stone: cost.stone * unique.length,
    silver: cost.silver * unique.length,
  }
  if (state.resources.wood < total.wood || state.resources.stone < total.stone || state.resources.silver < total.silver) {
    return { ok: false, reason: 'Не хватает припасов' }
  }

  state.resources.wood -= total.wood
  state.resources.stone -= total.stone
  state.resources.silver -= total.silver
  for (const point of unique) {
    state.buildings.push({ id: state.nextId++, kind, ...point, progress: 1, health: 100 })
  }
  state.events.push({
    id: state.nextId++,
    day: state.day,
    title: kind === 'road' ? 'Проложена улица' : 'Возведена линия стены',
    text: `Завершено участков: ${unique.length}.`,
    tone: 'good',
  })
  return { ok: true, placed: unique.length }
}

type MaterialBundle = { wood: number; stone: number; silver: number }

function scaledMaterials(cost: MaterialBundle, fraction: number, round: 'up' | 'down'): MaterialBundle {
  const apply = round === 'up' ? Math.ceil : Math.floor
  return {
    wood: apply(cost.wood * fraction),
    stone: apply(cost.stone * fraction),
    silver: apply(cost.silver * fraction),
  }
}

export function repairBuilding(
  state: GameState,
  buildingId: number,
): { ok: true; cost: MaterialBundle } | { ok: false; reason: string } {
  const building = state.buildings.find((item) => item.id === buildingId)
  if (!building) return { ok: false, reason: 'Постройка не найдена' }
  if (building.health >= 100) return { ok: false, reason: 'Постройка не нуждается в ремонте' }

  const damage = (100 - Math.max(0, building.health)) / 100
  const cost = scaledMaterials(BUILD_COSTS[building.kind], damage, 'up')
  if (state.resources.wood < cost.wood || state.resources.stone < cost.stone || state.resources.silver < cost.silver) {
    return { ok: false, reason: 'Не хватает материалов для ремонта' }
  }

  state.resources.wood -= cost.wood
  state.resources.stone -= cost.stone
  state.resources.silver -= cost.silver
  building.health = 100
  state.events.push({
    id: state.nextId++,
    day: state.day,
    title: 'Постройка восстановлена',
    text: `Завершён ремонт постройки №${building.id}.`,
    tone: 'good',
  })
  return { ok: true, cost }
}

export function demolishBuilding(
  state: GameState,
  buildingId: number,
): { ok: true; salvage: MaterialBundle } | { ok: false; reason: string } {
  const index = state.buildings.findIndex((item) => item.id === buildingId)
  if (index < 0) return { ok: false, reason: 'Постройка не найдена' }
  const building = state.buildings[index]!
  if (building.kind === 'townHall') return { ok: false, reason: 'Главное здание нельзя разобрать' }

  const salvage = scaledMaterials(BUILD_COSTS[building.kind], 0.25, 'down')
  state.buildings.splice(index, 1)
  state.resources.wood += salvage.wood
  state.resources.stone += salvage.stone
  state.resources.silver += salvage.silver
  state.events.push({
    id: state.nextId++,
    day: state.day,
    title: 'Участок расчищен',
    text: `Постройка №${building.id} разобрана; часть материалов возвращена на склад.`,
    tone: 'neutral',
  })
  return { ok: true, salvage }
}

export function revealThreat(state: GameState, kind: Threat['kind'], strength: number): Threat {
  const threat: Threat = {
    id: state.nextId++,
    kind,
    strength,
    supplies: 100,
    status: 'forming',
    intel: 'rumor',
    formedDay: state.day,
  }
  state.threats.push(threat)
  state.events.push({ id: state.nextId++, day: state.day, title: 'Тревожные слухи', text: 'Купцы видели костры за северным перевалом.', tone: 'warning' })
  return threat
}

export function dismissThreat(state: GameState, threatId: number, reason: 'supplies' | 'defeat' | 'diplomacy'): void {
  const threat = state.threats.find((item) => item.id === threatId)
  if (!threat) return
  threat.status = 'disbanded'
  threat.supplies = 0
  const cause = reason === 'supplies' ? 'из-за нехватки припасов' : reason === 'defeat' ? 'после поражения' : 'после переговоров'
  state.events.push({ id: state.nextId++, day: state.day, title: 'Угроза миновала', text: `Вражеские отряды рассеялись ${cause}.`, tone: 'good' })
}

export function settlementOutlook(state: GameState): SettlementOutlook {
  const farms = state.buildings.filter((building) => building.kind === 'farm' && building.progress >= 1).length
  const dailyFood = farms * 14 - Math.ceil(state.people * 0.12)
  const reserveDays = dailyFood < 0 ? Math.floor(state.resources.food / Math.abs(dailyFood)) : null
  const level = reserveDays === null || reserveDays > 30 ? 'secure' : reserveDays > 7 ? 'strained' : 'critical'
  return { dailyFood, reserveDays, level }
}

function escalateCrisis(state: GameState, kind: Crisis['kind'], title: string, text: string): void {
  const crisis = state.crises.find((item) => item.kind === kind)
  if (crisis) {
    crisis.pressure = Math.min(100, crisis.pressure + 8)
    return
  }
  state.crises.push({ id: state.nextId++, kind, pressure: 28 })
  state.events.push({ id: state.nextId++, day: state.day, title, text, tone: 'danger' })
}

export function addressCrisis(
  state: GameState,
  crisisId: number,
  responseKind: CrisisResponse = 'fund',
): { ok: true; resolved: boolean; summary: string } | { ok: false; reason: string } {
  const crisis = state.crises.find((item) => item.id === crisisId)
  if (!crisis) return { ok: false, reason: 'Кризис уже миновал' }

  const funded = {
    famine: { silver: CRISIS_FUND_COST.famine, pressure: 24, summary: 'Закуплено зерно для городских раздач' },
    rebellion: { silver: CRISIS_FUND_COST.rebellion, pressure: 24, summary: 'Демам предоставлены временные уступки' },
    coup: { silver: CRISIS_FUND_COST.coup, pressure: 22, summary: 'Знать принесла новые клятвы стратегу' },
  }[crisis.kind]
  const hardline = {
    famine: { pressure: 16, summary: 'Введены строгие хлебные пайки' },
    rebellion: { pressure: 32, summary: 'Тагма разогнала мятежные демы' },
    coup: { pressure: 30, summary: 'Заговорщики арестованы во дворце' },
  }[crisis.kind]

  let summary: string
  if (responseKind === 'fund') {
    if (state.resources.silver < funded.silver) return { ok: false, reason: 'В казне недостаточно средств' }
    state.resources.silver -= funded.silver
    crisis.pressure = Math.max(0, crisis.pressure - funded.pressure)
    summary = funded.summary
    if (crisis.kind === 'famine') {
      state.resources.food += 480
      state.order = Math.min(100, state.order + 4)
    } else if (crisis.kind === 'rebellion') {
      state.order = Math.min(100, state.order + 10)
      state.legitimacy = Math.max(0, state.legitimacy - 3)
    } else {
      state.legitimacy = Math.min(100, state.legitimacy + 12)
      state.order = Math.max(0, state.order - 2)
    }
  } else {
    crisis.pressure = Math.max(0, crisis.pressure - hardline.pressure)
    summary = hardline.summary
    if (crisis.kind === 'famine') {
      state.resources.food += 160
      state.order = Math.max(0, state.order - 7)
    } else if (crisis.kind === 'rebellion') {
      state.people = Math.max(0, state.people - 3)
      state.order = Math.min(100, state.order + 8)
      state.legitimacy = Math.max(0, state.legitimacy - 7)
    } else {
      state.order = Math.max(0, state.order - 8)
      state.legitimacy = Math.min(100, state.legitimacy + 6)
    }
  }

  const resolved = crisis.pressure === 0
  if (resolved) state.crises.splice(state.crises.indexOf(crisis), 1)
  state.events.push({
    id: state.nextId++,
    day: state.day,
    title: resolved ? 'Кризис урегулирован' : 'Решение Двора',
    text: summary,
    tone: resolved ? 'good' : 'warning',
  })
  return { ok: true, resolved, summary }
}

export function recommendedCrisisResponse(state: GameState, crisis: Crisis): CrisisResponse {
  return state.resources.silver >= CRISIS_FUND_COST[crisis.kind] ? 'fund' : 'hardline'
}

export function resolveRaid(
  state: GameState,
  threatId: number,
  defenseStrength: number,
): {
  outcome: 'victory' | 'defeat'
  enemyLosses: number
  cityLosses: number
  damagedBuildingIds: number[]
  burningBuildingIds: number[]
} {
  const threat = state.threats.find((item) => item.id === threatId)
  if (!threat || threat.status === 'disbanded' || threat.status === 'withdrawing') {
    return { outcome: 'victory', enemyLosses: 0, cityLosses: 0, damagedBuildingIds: [], burningBuildingIds: [] }
  }

  const enemyLosses = Math.min(threat.strength, Math.round(defenseStrength * 0.7))
  const cityLosses = Math.max(2, Math.round(threat.strength * 0.18 - defenseStrength * 0.09))
  const outcome = defenseStrength >= threat.strength * 0.7 ? 'victory' : 'defeat'
  threat.strength -= enemyLosses
  threat.status = outcome === 'victory' ? 'withdrawing' : 'raiding'
  state.people = Math.max(0, state.people - cityLosses)
  state.order = Math.max(0, state.order - (outcome === 'victory' ? 2 : 12))
  if (outcome === 'defeat') state.resources.food = Math.max(0, state.resources.food - 240)

  const distanceToNorthGate = (building: Building) => Math.hypot(building.x - 39, building.y - 7)
  const defenses = state.buildings
    .filter((building) => building.kind === 'wall' || building.kind === 'watchtower')
    .sort((left, right) => distanceToNorthGate(left) - distanceToNorthGate(right))
  const civilian = state.buildings
    .filter((building) => !['road', 'wall', 'watchtower', 'townHall'].includes(building.kind))
    .sort((left, right) => distanceToNorthGate(left) - distanceToNorthGate(right))
  const targets = [...defenses.slice(0, outcome === 'victory' ? 2 : 3), ...civilian.slice(0, outcome === 'victory' ? 1 : 3)]
  const damagedBuildingIds = targets.map((building) => building.id)
  const burningBuildingIds = civilian.slice(0, outcome === 'victory' ? 1 : 3).map((building) => building.id)
  const damage = outcome === 'victory' ? 8 : 28
  for (const building of targets) building.health = Math.max(10, building.health - damage)
  state.events.push({
    id: state.nextId++,
    day: state.day,
    title: outcome === 'victory' ? 'Налёт отбит' : 'Посад разграблен',
    text: outcome === 'victory' ? 'Дружина удержала Северные ворота.' : 'Враги прорвались к городским амбарам.',
    tone: outcome === 'victory' ? 'good' : 'danger',
  })
  return { outcome, enemyLosses, cityLosses, damagedBuildingIds, burningBuildingIds }
}

function applyCrisisConsequences(state: GameState): void {
  for (const crisis of [...state.crises]) {
    if (crisis.pressure < 60) continue
    if (crisis.kind === 'famine') {
      state.order = Math.max(0, state.order - 2)
      if (crisis.pressure >= 100) {
        state.people = Math.max(0, state.people - 4)
        crisis.pressure = 74
        state.events.push({ id: state.nextId++, day: state.day, title: 'Смерть у хлебных лавок', text: 'Голод унёс жизни и ожесточил посад.', tone: 'danger' })
      }
    } else if (crisis.kind === 'rebellion') {
      state.legitimacy = Math.max(0, state.legitimacy - 2)
      if (crisis.pressure >= 100) {
        state.people = Math.max(0, state.people - 6)
        crisis.pressure = 72
        state.events.push({ id: state.nextId++, day: state.day, title: 'Баррикады на Мессе', text: 'Мятежники удерживают городской квартал.', tone: 'danger' })
      }
    } else if (crisis.pressure >= 100) {
      state.crises.splice(state.crises.indexOf(crisis), 1)
      state.legitimacy = 35
      state.order = Math.max(0, state.order - 15)
      state.events.push({ id: state.nextId++, day: state.day, title: 'Дворцовый переворот', text: 'Знать сменила стратега и потребовала новых клятв.', tone: 'danger' })
    }
  }
}

export function advanceGame(
  state: GameState,
  days = 1,
  options: { campaignMarchTiming?: CampaignMarchTiming } = {},
): CampaignTurnReport[] {
  const reports: CampaignTurnReport[] = []
  for (let index = 0; index < days; index += 1) {
    state.day += 1
    state.tick += 240
    const campaignReports = advanceCampaign(state.campaign, 1, {
      marchTiming: options.campaignMarchTiming,
    })
    reports.push(...campaignReports)
    for (const report of campaignReports) {
      state.events.push({
        id: state.nextId++,
        day: state.day,
        title: report.kind === 'conquest'
          ? report.targetOwner === state.campaign.playerRealmId ? 'Пограничное поражение' : 'Чужой поход'
          : report.kind === 'march-started'
            ? 'Чужая рать выступила'
            : report.kind === 'march-resolved'
              ? 'Поход завершён'
          : report.kind === 'project-completed'
            ? report.actorId === state.campaign.playerRealmId ? 'Стройка завершена' : 'Чужое владение развито'
            : 'Срок перемирия истёк',
        text: report.message,
        tone: report.kind === 'project-completed' && report.actorId === state.campaign.playerRealmId
          ? 'good'
          : report.targetOwner === state.campaign.playerRealmId ? 'danger' : 'warning',
      })
    }

    const farms = state.buildings.filter((building) => building.kind === 'farm' && building.progress >= 1).length
    const camps = state.buildings.filter((building) => building.kind === 'lumberCamp' && building.progress >= 1).length
    state.resources.food += farms * 14 - Math.ceil(state.people * 0.12)
    state.resources.wood += camps * 8

    for (const building of state.buildings) {
      if (building.progress < 1) building.progress = Math.min(1, building.progress + 0.18)
    }

    if (state.resources.food < 0) {
      state.resources.food = 0
      state.order = Math.max(0, state.order - 4)
      const famine = state.crises.find((crisis) => crisis.kind === 'famine')
      if (famine) famine.pressure = Math.min(100, famine.pressure + 14)
      else if (state.day >= 7) {
        state.crises.push({ id: state.nextId++, kind: 'famine', pressure: 30 })
        state.events.push({ id: state.nextId++, day: state.day, title: 'Голод в посаде', text: 'Пустые амбары вызывают беспорядки.', tone: 'danger' })
      }
    }

    if (state.order < 30) {
      escalateCrisis(state, 'rebellion', 'Бунт в посаде', 'Недовольные ремесленники возводят баррикады у рынка.')
    }
    if (state.legitimacy < 25) {
      escalateCrisis(state, 'coup', 'Заговор знати', 'Часть бояр обсуждает смену правителя за закрытыми дверями.')
    }
    applyCrisisConsequences(state)

    for (const threat of state.threats) {
      const age = state.day - threat.formedDay
      if (threat.status === 'forming' && age >= 2) {
        threat.status = 'approaching'
        threat.intel = 'confirmed'
      } else if (threat.status === 'approaching' && age >= 5) {
        threat.status = 'raiding'
      }
      if (threat.status !== 'disbanded') {
        threat.supplies = Math.max(0, threat.supplies - 8)
        if (threat.supplies === 0) dismissThreat(state, threat.id, 'supplies')
      }
    }

    if (state.day > 90) {
      state.day = 1
      state.season = state.season === 'Осень' ? 'Зима' : state.season === 'Зима' ? 'Весна' : state.season === 'Весна' ? 'Лето' : 'Осень'
      if (state.season === 'Весна') state.year += 1
    }
  }
  return reports
}
